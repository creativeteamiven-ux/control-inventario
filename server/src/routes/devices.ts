import { Router } from 'express';
import QRCode from 'qrcode';
import path from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';
import { createDeviceSchema, updateDeviceSchema, deviceFilterSchema } from '@soundvault/shared';
import { AppError } from '../middleware/errorHandler.js';
import { authenticate, AuthRequest, requirePermission } from '../middleware/auth.js';
import { stripCostFromResponse } from '../lib/permissions.js';
import { writeAudit } from '../lib/audit.js';
import { computeDepreciation } from '../lib/depreciation.js';

const router = Router();
const prisma = new PrismaClient();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE_URL = process.env.CLIENT_URL || 'http://localhost:5173';

router.use(authenticate);

function getNextInternalCode(prefix: string): Promise<string> {
  return prisma.device
    .findFirst({
      where: { internalCode: { startsWith: prefix } },
      orderBy: { internalCode: 'desc' },
    })
    .then((d) => {
      const num = d ? parseInt(d.internalCode.replace(prefix + '-', ''), 10) + 1 : 1;
      return `${prefix}-${String(num).padStart(3, '0')}`;
    });
}

router.get('/', async (req, res, next) => {
  try {
    const parsed = deviceFilterSchema.safeParse({
      ...req.query,
      page: req.query.page ? Number(req.query.page) : 1,
      limit: req.query.limit ? Number(req.query.limit) : 50,
      needsReview: req.query.needsReview === 'true' || req.query.needsReview === '1',
    });
    const filters = parsed.success ? parsed.data : { page: 1, limit: 50 };
    const where: Record<string, unknown> = { deletedAt: null };
    if (filters.categoryId) where.categoryId = filters.categoryId;
    if (filters.status) where.status = filters.status;
    if (filters.location) where.location = filters.location;
    if (filters.brand) where.brand = filters.brand;
    if (filters.needsReview) {
      where.status = 'ACTIVE';
      where.AND = [
        ...((where.AND as object[]) || []),
        {
          OR: [
            { AND: [{ observation: { not: null } }, { observation: { not: '' } }] },
            { condition: { lt: 70 } },
          ],
        },
      ];
    }
    if (filters.search) {
      const searchClause = {
        OR: [
          { name: { contains: filters.search, mode: 'insensitive' as const } },
          { brand: { contains: filters.search, mode: 'insensitive' as const } },
          { model: { contains: filters.search, mode: 'insensitive' as const } },
          { internalCode: { contains: filters.search, mode: 'insensitive' as const } },
          { serialNumber: { contains: filters.search, mode: 'insensitive' as const } },
        ],
      };
      where.AND = [...((where.AND as object[]) || []), searchClause];
    }
    if (filters.conditionMin != null) where.condition = { ...((where.condition as object) || {}), gte: filters.conditionMin };
    if (filters.conditionMax != null) where.condition = { ...((where.condition as object) || {}), lte: filters.conditionMax };

    const [devices, total] = await Promise.all([
      prisma.device.findMany({
        where,
        include: { category: { select: { id: true, name: true, slug: true, color: true } }, images: { orderBy: { order: 'asc' }, take: 1 } },
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
        orderBy: { internalCode: 'asc' },
      }),
      prisma.device.count({ where }),
    ]);
    const perms = (req as AuthRequest).user?.permissions ?? [];
    const payload = { devices: stripCostFromResponse(devices, perms), total, page: filters.page, limit: filters.limit };
    res.json(payload);
  } catch (e) {
    next(e);
  }
});

// Búsqueda rápida para el escáner: acepta número de serie, código interno, id o una URL de QR.
router.get('/lookup', async (req, res, next) => {
  try {
    let raw = String(req.query.code ?? '').trim();
    if (!raw) throw new AppError(400, 'Indica un código para buscar');
    // Si se escaneó una URL de QR (ej: .../device/<id> o .../inventory/<id>), extraer el id/código.
    const urlMatch = raw.match(/\/(?:device|inventory)\/([^/?#]+)/i);
    if (urlMatch) raw = decodeURIComponent(urlMatch[1]);

    const device = await prisma.device.findFirst({
      where: {
        deletedAt: null,
        OR: [
          { id: raw },
          { internalCode: { equals: raw, mode: 'insensitive' } },
          { serialNumber: { equals: raw, mode: 'insensitive' } },
        ],
      },
      include: {
        category: { select: { id: true, name: true, color: true } },
        images: { orderBy: { order: 'asc' }, take: 1 },
      },
    });
    if (!device) throw new AppError(404, 'No se encontró ningún equipo con ese código');
    const perms = (req as AuthRequest).user?.permissions ?? [];
    res.json(stripCostFromResponse(device, perms));
  } catch (e) {
    next(e);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const device = await prisma.device.findFirst({
      where: { id: req.params.id, deletedAt: null },
      include: {
        category: true,
        images: { orderBy: { order: 'asc' } },
        documents: true,
        movements: { include: { user: { select: { name: true } } }, take: 20, orderBy: { createdAt: 'desc' } },
        maintenances: { take: 10, orderBy: { startDate: 'desc' } },
        loanRecords: { take: 5, orderBy: { loanDate: 'desc' } },
      },
    });
    if (!device) throw new AppError(404, 'Equipo no encontrado');
    const perms = (req as AuthRequest).user?.permissions ?? [];
    res.json(stripCostFromResponse(device, perms));
  } catch (e) {
    next(e);
  }
});

// Resumen financiero del equipo: depreciación, valor en libros y costo total de propiedad (TCO).
router.get('/:id/financials', requirePermission('sensitive.view_cost'), async (req, res, next) => {
  try {
    const device = await prisma.device.findFirst({
      where: { id: req.params.id, deletedAt: null },
      include: { category: { select: { usefulLifeYears: true } } },
    });
    if (!device) throw new AppError(404, 'Equipo no encontrado');

    const purchasePrice = device.purchasePrice != null ? Number(device.purchasePrice) : null;
    const depreciation = computeDepreciation(
      purchasePrice,
      device.purchaseDate,
      device.category?.usefulLifeYears,
    );

    const maintAgg = await prisma.maintenance.aggregate({
      where: { deviceId: device.id },
      _sum: { cost: true },
    });
    const maintenanceCost = Number(maintAgg._sum.cost || 0);

    const expenses = await prisma.expense.findMany({
      where: { deviceId: device.id },
      select: { amount: true, currency: true },
    });
    const expensesByCurrency: Record<string, number> = {};
    for (const e of expenses) {
      expensesByCurrency[e.currency] = (expensesByCurrency[e.currency] || 0) + Number(e.amount);
    }
    // TCO en COP (moneda base): precio de compra + mantenimientos + gastos en COP.
    const expensesCOP = expensesByCurrency['COP'] || 0;
    const tcoCOP = (purchasePrice || 0) + maintenanceCost + expensesCOP;

    res.json({
      depreciation,
      maintenanceCost,
      expensesByCurrency,
      tcoCOP: Math.round(tcoCOP * 100) / 100,
    });
  } catch (e) {
    next(e);
  }
});

// Cambio masivo de estado (y opcionalmente ubicación).
// Si status es MAINTENANCE: se crea un registro en Maintenance por cada equipo (para que aparezca en el módulo Mantenimiento).
// Si status es LOANED: se crea un registro en LoanRecord por cada equipo (para que aparezca en el módulo Préstamos).
const validStatuses = ['ACTIVE', 'MAINTENANCE', 'LOANED', 'DAMAGED', 'LOST', 'RETIRED'];
router.patch('/bulk', requirePermission('inventory.edit'), async (req: AuthRequest, res, next) => {
  try {
    const { deviceIds, status, location } = req.body as { deviceIds?: string[]; status?: string; location?: string };
    if (!Array.isArray(deviceIds) || deviceIds.length === 0) {
      throw new AppError(400, 'deviceIds debe ser un array con al menos un id');
    }
    const update: Record<string, unknown> = {};
    if (status != null) {
      if (!validStatuses.includes(String(status))) {
        throw new AppError(400, `Estado inválido. Use: ${validStatuses.join(', ')}`);
      }
      update.status = status;
    }
    if (location != null) {
      const validLocs = ['MAIN_AUDITORIUM', 'RECORDING_STUDIO', 'STORAGE_ROOM', 'YOUTH_ROOM', 'CHAPEL', 'ON_LOAN'];
      if (!validLocs.includes(String(location))) {
        throw new AppError(400, `Ubicación inválida. Use: ${validLocs.join(', ')}`);
      }
      update.location = location;
    }
    if (status === 'LOANED' && !(update as Record<string, string>).location) {
      (update as Record<string, string>).location = 'ON_LOAN';
    }
    if (Object.keys(update).length === 0) {
      throw new AppError(400, 'Indique status y/o location para actualizar');
    }
    const userId = req.user!.userId;
    const devices = await prisma.device.findMany({
      where: { id: { in: deviceIds }, deletedAt: null },
      select: { id: true },
    });
    const ids = devices.map((d) => d.id);
    if (ids.length === 0) {
      return res.json({ updated: 0 });
    }
    await prisma.$transaction(async (tx) => {
      await tx.device.updateMany({
        where: { id: { in: ids } },
        data: update as Parameters<typeof tx.device.updateMany>[0]['data'],
      });
      if (status === 'MAINTENANCE') {
        const now = new Date();
        await Promise.all(
          ids.map((deviceId) =>
            tx.maintenance.create({
              data: {
                deviceId,
                type: 'preventivo',
                description: 'Enviado a mantenimiento (selección masiva)',
                startDate: now,
                status: 'SCHEDULED',
                userId,
              },
            })
          )
        );
      }
      if (status === 'LOANED') {
        const now = new Date();
        const returnDate = new Date(now);
        returnDate.setDate(returnDate.getDate() + 7);
        await Promise.all(
          ids.map((deviceId) =>
            tx.loanRecord.create({
              data: {
                deviceId,
                borrowerName: 'Por asignar',
                purpose: 'Pendiente de asignar',
                loanDate: now,
                expectedReturn: returnDate,
                status: 'ACTIVE',
                approvedBy: userId,
              },
            })
          )
        );
      }
    });
    await writeAudit(req, 'Device', ids.join(','), 'STATUS_CHANGE', { status, location, count: ids.length });
    res.json({ updated: ids.length });
  } catch (e) {
    next(e);
  }
});

router.post('/', requirePermission('inventory.create'), async (req: AuthRequest, res, next) => {
  try {
    const parsed = createDeviceSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError(400, parsed.error.errors[0]?.message || 'Datos inválidos');
    const category = await prisma.category.findUnique({ where: { id: parsed.data.categoryId } });
    if (!category) throw new AppError(400, 'Categoría no encontrada');
    const prefix = category.slug.split('-')[0].toUpperCase().slice(0, 3) || 'EQP';
    const internalCode = await getNextInternalCode(prefix);
    const data = {
      ...parsed.data,
      purchaseDate: parsed.data.purchaseDate ? new Date(parsed.data.purchaseDate as string) : null,
      warrantyExpiry: parsed.data.warrantyExpiry ? new Date(parsed.data.warrantyExpiry as string) : null,
      purchasePrice: parsed.data.purchasePrice ?? null,
      internalCode,
      createdBy: req.user!.userId,
    };
    const device = await prisma.device.create({
      data: data as Parameters<typeof prisma.device.create>[0]['data'],
      include: { category: true },
    });
    await writeAudit(req, 'Device', device.id, 'CREATE', { name: device.name, internalCode: device.internalCode });
    res.status(201).json(device);
  } catch (e) {
    next(e);
  }
});

router.patch('/:id', requirePermission('inventory.edit'), async (req: AuthRequest, res, next) => {
  try {
    const parsed = updateDeviceSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError(400, parsed.error.errors[0]?.message || 'Datos inválidos');
    const update: Record<string, unknown> = { ...parsed.data };
    if (parsed.data.purchaseDate != null) update.purchaseDate = new Date(parsed.data.purchaseDate as string);
    if (parsed.data.warrantyExpiry != null) update.warrantyExpiry = new Date(parsed.data.warrantyExpiry as string);
    const device = await prisma.device.update({
      where: { id: req.params.id },
      data: update as Parameters<typeof prisma.device.update>[0]['data'],
      include: { category: true, images: true },
    });
    await writeAudit(req, 'Device', device.id, 'UPDATE', parsed.data);
    res.json(device);
  } catch (e) {
    next(e);
  }
});

router.delete('/:id', requirePermission('inventory.delete'), async (req: AuthRequest, res, next) => {
  try {
    await prisma.device.update({
      where: { id: req.params.id },
      data: { deletedAt: new Date() },
    });
    await writeAudit(req, 'Device', req.params.id, 'DELETE');
    res.status(204).send();
  } catch (e) {
    next(e);
  }
});

router.get('/:id/movements', async (req, res, next) => {
  try {
    const movements = await prisma.movement.findMany({
      where: { deviceId: req.params.id },
      include: { user: { select: { name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    res.json(movements);
  } catch (e) {
    next(e);
  }
});

router.get('/:id/qr', async (req, res, next) => {
  try {
    const device = await prisma.device.findFirst({
      where: { id: req.params.id, deletedAt: null },
      select: { id: true, internalCode: true, qrCode: true, isQrGenerated: true },
    });
    if (!device) throw new AppError(404, 'Equipo no encontrado');
    const url = `${BASE_URL}/device/${device.id}`;
    if (device.isQrGenerated && device.qrCode) {
      return res.json({ qrCode: device.qrCode, url });
    }
    const qrDataUrl = await QRCode.toDataURL(url, { width: 300 });
    await prisma.device.update({
      where: { id: device.id },
      data: { qrCode: qrDataUrl, isQrGenerated: true },
    });
    res.json({ qrCode: qrDataUrl, url });
  } catch (e) {
    next(e);
  }
});

export default router;
