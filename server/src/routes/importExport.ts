/**
 * Importaci?n masiva de equipos y traslados desde Excel
 */
import { Router } from 'express';
import multer from 'multer';
import * as XLSX from 'xlsx';
import { PrismaClient } from '@prisma/client';
import { AppError } from '../middleware/errorHandler.js';
import { authenticate, AuthRequest, requireRole } from '../middleware/auth.js';

const router = Router();
const prisma = new PrismaClient();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

router.use(authenticate);

function getNextInternalCode(prefix: string): Promise<string> {
  return prisma.device
    .findFirst({
      where: { internalCode: { startsWith: prefix } },
      orderBy: { internalCode: 'desc' },
    })
    .then((d) => {
      const num = d ? parseInt(String(d.internalCode).replace(prefix + '-', ''), 10) + 1 : 1;
      return `${prefix}-${String(num).padStart(3, '0')}`;
    });
}

// Importar equipos desde Excel
router.post('/devices', requireRole('ADMIN', 'MANAGER'), upload.single('file'), async (req: AuthRequest, res, next) => {
  try {
    const file = req.file;
    if (!file) throw new AppError(400, 'No se envi? archivo Excel');
    const wb = XLSX.read(file.buffer, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1 }) as string[][];
    if (rows.length < 2) throw new AppError(400, 'El archivo debe tener al menos una fila de datos');
    const headers = rows[0].map((h) => String(h || '').trim());
    const nameIdx = headers.findIndex((h) => /nombre/i.test(h));
    const brandIdx = headers.findIndex((h) => /marca/i.test(h));
    const modelIdx = headers.findIndex((h) => /modelo/i.test(h));
    if (nameIdx < 0 || brandIdx < 0 || modelIdx < 0) {
      throw new AppError(400, 'El archivo debe tener columnas: Nombre, Marca, Modelo');
    }
    const slugIdx = headers.findIndex((h) => /categoria|slug/i.test(h));
    const statusIdx = headers.findIndex((h) => /estado/i.test(h));
    const locIdx = headers.findIndex((h) => /ubicacion|ubicaci?n/i.test(h));
    const serialIdx = headers.findIndex((h) => /serie/i.test(h));
    const priceIdx = headers.findIndex((h) => /precio/i.test(h));
    const supplierIdx = headers.findIndex((h) => /proveedor/i.test(h));
    const notesIdx = headers.findIndex((h) => /notas/i.test(h));
    const observationIdx = headers.findIndex((h) => /observacion|observaci?n/i.test(h));
    const condIdx = headers.findIndex((h) => /condicion|condici?n/i.test(h));

    const categories = await prisma.category.findMany({ select: { id: true, slug: true, name: true } });
    const slugToId = new Map<string, string>();
    categories.forEach((c) => {
      slugToId.set(c.slug.toLowerCase(), c.id);
      slugToId.set(c.name.toLowerCase(), c.id);
    });

    const results: { success: number; errors: { row: number; message: string }[] } = { success: 0, errors: [] };
    const userId = req.user!.userId;

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i] || [];
      const name = String(row[nameIdx] ?? '').trim();
      const brand = String(row[brandIdx] ?? '').trim();
      const model = String(row[modelIdx] ?? '').trim();
      if (!name || !brand || !model) {
        results.errors.push({ row: i + 1, message: 'Nombre, Marca y Modelo son obligatorios' });
        continue;
      }
      const slug = slugIdx >= 0 ? String(row[slugIdx] ?? '').trim().toLowerCase() : 'audio-pa';
      const categoryId = slugToId.get(slug) || categories[0]?.id;
      if (!categoryId) {
        results.errors.push({ row: i + 1, message: 'Categor?a no encontrada. Use: consolas, microfonos, parlantes, etc.' });
        continue;
      }
      const prefix = slug.split('-')[0].toUpperCase().slice(0, 3) || 'EQP';
      const internalCode = await getNextInternalCode(prefix);
      const status = (statusIdx >= 0 && row[statusIdx] ? String(row[statusIdx]).trim().toUpperCase() : 'ACTIVE') as
        | 'ACTIVE'
        | 'MAINTENANCE'
        | 'DAMAGED'
        | 'LOST'
        | 'RETIRED'
        | 'LOANED';
      const location = (locIdx >= 0 && row[locIdx] ? String(row[locIdx]).trim().toUpperCase().replace(/\s/g, '_') : 'STORAGE_ROOM') as
        | 'MAIN_AUDITORIUM'
        | 'RECORDING_STUDIO'
        | 'STORAGE_ROOM'
        | 'YOUTH_ROOM'
        | 'CHAPEL'
        | 'ON_LOAN';
      const serialNumber = serialIdx >= 0 && row[serialIdx] ? String(row[serialIdx]).trim() : null;
      const purchasePrice = priceIdx >= 0 && row[priceIdx] ? parseFloat(String(row[priceIdx]).replace(',', '.')) : null;
      const supplier = supplierIdx >= 0 && row[supplierIdx] ? String(row[supplierIdx]).trim() : null;
      const notes = notesIdx >= 0 && row[notesIdx] ? String(row[notesIdx]).trim() : null;
      const observation = observationIdx >= 0 && row[observationIdx] ? String(row[observationIdx]).trim().slice(0, 500) : null;
      const condition = condIdx >= 0 && row[condIdx] ? Math.min(100, Math.max(0, parseInt(String(row[condIdx]), 10) || 100)) : 100;

      try {
        await prisma.device.create({
          data: {
            name,
            brand,
            model,
            serialNumber,
            internalCode,
            categoryId,
            status,
            location,
            purchasePrice,
            supplier,
            notes,
            observation: observation || undefined,
            condition,
            createdBy: userId,
          },
        });
        results.success++;
      } catch (err) {
        results.errors.push({ row: i + 1, message: (err as Error).message });
      }
    }

    res.json(results);
  } catch (e) {
    next(e);
  }
});

// Importar traslados desde Excel
router.post('/movements', requireRole('ADMIN', 'MANAGER', 'TECHNICIAN'), upload.single('file'), async (req: AuthRequest, res, next) => {
  try {
    const file = req.file;
    if (!file) throw new AppError(400, 'No se envi? archivo Excel');
    const wb = XLSX.read(file.buffer, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1 }) as string[][];
    if (rows.length < 2) throw new AppError(400, 'El archivo debe tener al menos una fila de datos');
    const headers = rows[0].map((h) => String(h || '').trim());
    const codeIdx = headers.findIndex((h) => /codigo|c?digo/i.test(h));
    const typeIdx = headers.findIndex((h) => /tipo/i.test(h));
    const reasonIdx = headers.findIndex((h) => /razon|raz?n|motivo/i.test(h));
    const fromIdx = headers.findIndex((h) => /desde|origen/i.test(h));
    const toIdx = headers.findIndex((h) => /hasta|destino/i.test(h));
    const respIdx = headers.findIndex((h) => /responsable/i.test(h));
    const dateIdx = headers.findIndex((h) => /fecha/i.test(h));
    if (codeIdx < 0 || reasonIdx < 0) {
      throw new AppError(400, 'El archivo debe tener columnas: Codigo_Equipo y Razon');
    }

    const validTypes = ['CHECK_IN', 'CHECK_OUT', 'TRANSFER', 'STATUS_CHANGE'];
    const validLocs = ['MAIN_AUDITORIUM', 'RECORDING_STUDIO', 'STORAGE_ROOM', 'YOUTH_ROOM', 'CHAPEL', 'ON_LOAN'];

    const results: { success: number; errors: { row: number; message: string }[] } = { success: 0, errors: [] };
    const defaultUserId = req.user!.userId;

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i] || [];
      const code = String(row[codeIdx] ?? '').trim();
      const reason = String(row[reasonIdx] ?? '').trim();
      if (!code || !reason) {
        results.errors.push({ row: i + 1, message: 'C?digo y raz?n son obligatorios' });
        continue;
      }
      const device = await prisma.device.findFirst({ where: { internalCode: code, deletedAt: null } });
      if (!device) {
        results.errors.push({ row: i + 1, message: `Equipo ${code} no encontrado` });
        continue;
      }
      const type = (typeIdx >= 0 && row[typeIdx] ? String(row[typeIdx]).trim().toUpperCase() : 'TRANSFER') as
        | 'CHECK_IN'
        | 'CHECK_OUT'
        | 'TRANSFER'
        | 'STATUS_CHANGE';
      if (!validTypes.includes(type)) {
        results.errors.push({ row: i + 1, message: `Tipo inv?lido. Use: ${validTypes.join(', ')}` });
        continue;
      }
      const fromLoc =
        fromIdx >= 0 && row[fromIdx]
          ? String(row[fromIdx])
              .trim()
              .toUpperCase()
              .replace(/\s/g, '_')
          : device.location;
      const toLoc =
        toIdx >= 0 && row[toIdx]
          ? String(row[toIdx])
              .trim()
              .toUpperCase()
              .replace(/\s/g, '_')
          : device.location;
      if (validLocs.indexOf(fromLoc) < 0 || validLocs.indexOf(toLoc) < 0) {
        results.errors.push({ row: i + 1, message: 'Ubicaciones inv?lidas' });
        continue;
      }

      let moveUserId = defaultUserId;
      if (respIdx >= 0 && row[respIdx]) {
        const respEmail = String(row[respIdx]).trim();
        const respUser = await prisma.user.findFirst({ where: { email: { equals: respEmail, mode: 'insensitive' } } });
        if (respUser) moveUserId = respUser.id;
      }

      const moveDate = dateIdx >= 0 && row[dateIdx]
        ? new Date(String(row[dateIdx]))
        : new Date();
      if (isNaN(moveDate.getTime())) {
        results.errors.push({ row: i + 1, message: 'Fecha inv?lida' });
        continue;
      }

      try {
        await prisma.$transaction([
          prisma.movement.create({
            data: {
              deviceId: device.id,
              type,
              fromLocation: fromLoc as 'MAIN_AUDITORIUM' | 'RECORDING_STUDIO' | 'STORAGE_ROOM' | 'YOUTH_ROOM' | 'CHAPEL' | 'ON_LOAN',
              toLocation: toLoc as 'MAIN_AUDITORIUM' | 'RECORDING_STUDIO' | 'STORAGE_ROOM' | 'YOUTH_ROOM' | 'CHAPEL' | 'ON_LOAN',
              reason,
              userId: moveUserId,
              createdAt: moveDate,
            },
          }),
          prisma.device.update({
            where: { id: device.id },
            data: { location: toLoc as 'MAIN_AUDITORIUM' | 'RECORDING_STUDIO' | 'STORAGE_ROOM' | 'YOUTH_ROOM' | 'CHAPEL' | 'ON_LOAN' },
          }),
        ]);
        results.success++;
      } catch (err) {
        results.errors.push({ row: i + 1, message: (err as Error).message });
      }
    }

    res.json(results);
  } catch (e) {
    next(e);
  }
});

// Importar equipos a mantenimiento: Excel con Codigo_Equipo, Descripcion, Tipo, Fecha_inicio
// Por cada fila: actualiza estado del equipo a MAINTENANCE y crea registro de mantenimiento
router.post('/maintenance', requireRole('ADMIN', 'MANAGER', 'TECHNICIAN'), upload.single('file'), async (req: AuthRequest, res, next) => {
  try {
    const file = req.file;
    if (!file) throw new AppError(400, 'No se envi? archivo Excel');
    const wb = XLSX.read(file.buffer, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1 }) as string[][];
    if (rows.length < 2) throw new AppError(400, 'El archivo debe tener al menos una fila de datos');
    const headers = rows[0].map((h) => String(h || '').trim());
    const codeIdx = headers.findIndex((h) => /codigo|c?digo|equipo/i.test(h));
    const descIdx = headers.findIndex((h) => /descripcion|descripci?n|motivo/i.test(h));
    const typeIdx = headers.findIndex((h) => /tipo/i.test(h));
    const dateIdx = headers.findIndex((h) => /fecha|inicio/i.test(h));
    if (codeIdx < 0 || descIdx < 0) {
      throw new AppError(400, 'El archivo debe tener columnas: Codigo_Equipo y Descripcion');
    }
    const results: { success: number; errors: { row: number; message: string }[] } = { success: 0, errors: [] };
    const userId = req.user!.userId;
    const validTypes = ['preventivo', 'correctivo', 'calibraci?n', 'calibracion'];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i] || [];
      const code = String(row[codeIdx] ?? '').trim();
      const description = String(row[descIdx] ?? '').trim();
      if (!code || !description) {
        results.errors.push({ row: i + 1, message: 'Codigo_Equipo y Descripcion son obligatorios' });
        continue;
      }
      const device = await prisma.device.findFirst({ where: { internalCode: code, deletedAt: null } });
      if (!device) {
        results.errors.push({ row: i + 1, message: `Equipo ${code} no encontrado` });
        continue;
      }
      const typeRaw = typeIdx >= 0 && row[typeIdx] ? String(row[typeIdx]).trim().toLowerCase() : 'preventivo';
      const type = validTypes.includes(typeRaw) ? typeRaw : 'preventivo';
      let startDate = new Date();
      if (dateIdx >= 0 && row[dateIdx]) {
        const parsed = new Date(String(row[dateIdx]));
        if (!Number.isNaN(parsed.getTime())) startDate = parsed;
      }
      try {
        await prisma.$transaction([
          prisma.device.update({
            where: { id: device.id },
            data: { status: 'MAINTENANCE' },
          }),
          prisma.maintenance.create({
            data: {
              deviceId: device.id,
              type,
              description,
              startDate,
              status: 'SCHEDULED',
              userId,
            },
          }),
        ]);
        results.success++;
      } catch (err) {
        results.errors.push({ row: i + 1, message: (err as Error).message });
      }
    }

    res.json(results);
  } catch (e) {
    next(e);
  }
});

// Cargar datos de mantenimiento de forma masiva (actualizar registros existentes)
// Excel con Id_Mantenimiento y columnas: Tipo, Descripcion, Fecha_inicio, Estado, Costo, Tecnico, Fecha_fin, Notas
router.post('/maintenance-update', requireRole('ADMIN', 'MANAGER', 'TECHNICIAN'), upload.single('file'), async (req: AuthRequest, res, next) => {
  try {
    const file = req.file;
    if (!file) throw new AppError(400, 'No se envi? archivo Excel');
    const wb = XLSX.read(file.buffer, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1 }) as string[][];
    if (rows.length < 2) throw new AppError(400, 'El archivo debe tener al menos una fila de datos');
    const headers = rows[0].map((h) => String(h || '').trim());
    const maintIdCol = headers.findIndex((h) => /id_mantenimiento|id/i.test(String(h)) && /mantenimiento/i.test(String(h)));
    const altCol = headers.findIndex((h) => String(h).trim() === 'Id_Mantenimiento');
    const maintIdIdx = maintIdCol >= 0 ? maintIdCol : altCol;
    if (maintIdIdx < 0) throw new AppError(400, 'El archivo debe tener la columna Id_Mantenimiento');
    const typeIdx = headers.findIndex((h) => /tipo/i.test(h));
    const descIdx = headers.findIndex((h) => /descripcion|descripci?n/i.test(h));
    const startIdx = headers.findIndex((h) => /fecha_inicio|inicio/i.test(h));
    const statusIdx = headers.findIndex((h) => /estado/i.test(h));
    const costIdx = headers.findIndex((h) => /costo/i.test(h));
    const techIdx = headers.findIndex((h) => /tecnico|t?cnico/i.test(h));
    const endIdx = headers.findIndex((h) => /fecha_fin|fin/i.test(h));
    const notesIdx = headers.findIndex((h) => /notas/i.test(h));
    const results: { success: number; errors: { row: number; message: string }[] } = { success: 0, errors: [] };
    const validStatuses = ['SCHEDULED', 'IN_PROGRESS', 'COMPLETED'];
    const validTypes = ['preventivo', 'correctivo', 'calibraci?n', 'calibracion'];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i] || [];
      const id = String(row[maintIdIdx] ?? '').trim();
      if (!id) {
        results.errors.push({ row: i + 1, message: 'Id_Mantenimiento es obligatorio' });
        continue;
      }
      const maintenance = await prisma.maintenance.findUnique({
        where: { id },
        include: { device: true },
      });
      if (!maintenance) {
        results.errors.push({ row: i + 1, message: `Registro de mantenimiento ${id} no encontrado` });
        continue;
      }
      const update: Record<string, unknown> = {};
      if (typeIdx >= 0 && row[typeIdx] != null && String(row[typeIdx]).trim()) {
        const t = String(row[typeIdx]).trim().toLowerCase();
        if (validTypes.includes(t)) update.type = t;
      }
      if (descIdx >= 0 && row[descIdx] != null && String(row[descIdx]).trim()) {
        update.description = String(row[descIdx]).trim();
      }
      if (startIdx >= 0 && row[startIdx]) {
        const d = new Date(String(row[startIdx]));
        if (!Number.isNaN(d.getTime())) update.startDate = d;
      }
      if (statusIdx >= 0 && row[statusIdx] != null && String(row[statusIdx]).trim()) {
        const st = String(row[statusIdx]).trim().toUpperCase();
        if (validStatuses.includes(st)) update.status = st;
      }
      if (costIdx >= 0 && row[costIdx] != null && String(row[costIdx]).trim() !== '') {
        const n = parseFloat(String(row[costIdx]).replace(',', '.'));
        if (!Number.isNaN(n)) update.cost = n;
      }
      if (techIdx >= 0 && row[techIdx] != null) update.technician = String(row[techIdx]).trim() || null;
      if (endIdx >= 0 && row[endIdx]) {
        const d = new Date(String(row[endIdx]));
        if (!Number.isNaN(d.getTime())) update.endDate = d;
      }
      if (notesIdx >= 0 && row[notesIdx] != null) update.notes = String(row[notesIdx]).trim() || null;
      const newStatus = (update.status as string) || maintenance.status;
      if (newStatus === 'COMPLETED' && !update.endDate && !maintenance.endDate) {
        (update as { endDate: Date }).endDate = new Date();
      }
      if (Object.keys(update).length === 0) {
        results.errors.push({ row: i + 1, message: 'No hay datos que actualizar en esta fila' });
        continue;
      }
      try {
        await prisma.$transaction(async (tx) => {
          await tx.maintenance.update({
            where: { id: maintenance.id },
            data: update as Parameters<typeof tx.maintenance.update>[0]['data'],
          });
          if (newStatus === 'COMPLETED') {
            await tx.device.update({
              where: { id: maintenance.deviceId },
              data: { status: 'ACTIVE' },
            });
          }
        });
        results.success++;
      } catch (err) {
        results.errors.push({ row: i + 1, message: (err as Error).message });
      }
    }

    res.json(results);
  } catch (e) {
    next(e);
  }
});

export default router;
