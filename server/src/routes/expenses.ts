import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import type { ExpenseCategory } from '@prisma/client';
import * as XLSX from 'xlsx';
import { createExpenseSchema, updateExpenseSchema } from '@soundvault/shared';
import { AppError } from '../middleware/errorHandler.js';
import { authenticate, AuthRequest, requirePermission } from '../middleware/auth.js';
import { writeAudit } from '../lib/audit.js';

const CATEGORY_LABELS: Record<string, string> = {
  PURCHASE: 'Compra de equipo',
  REPAIR: 'Reparación',
  MAINTENANCE: 'Mantenimiento / servicio',
  ACCESSORY: 'Accesorios / consumibles',
  RENTAL: 'Alquiler',
  SERVICE: 'Servicios',
  OTHER: 'Otro',
};

const router = Router();
const prisma = new PrismaClient();

router.use(authenticate);

// Solo quien puede ver finanzas accede al módulo.
router.use(requirePermission('finance.view'));

function buildDateRange(from?: string, to?: string): { gte?: Date; lte?: Date } | undefined {
  const range: { gte?: Date; lte?: Date } = {};
  if (from) range.gte = new Date(from);
  if (to) {
    const end = new Date(to);
    end.setHours(23, 59, 59, 999);
    range.lte = end;
  }
  return Object.keys(range).length ? range : undefined;
}

/** Listar gastos con filtros: from, to, category, deviceId, currency */
router.get('/', async (req, res, next) => {
  try {
    const { from, to, category, deviceId, currency } = req.query as Record<string, string | undefined>;
    const where: Record<string, unknown> = {};
    const dateRange = buildDateRange(from, to);
    if (dateRange) where.date = dateRange;
    if (category) where.category = category as ExpenseCategory;
    if (deviceId) where.deviceId = deviceId;
    if (currency) where.currency = currency;
    const items = await prisma.expense.findMany({
      where,
      include: { device: { select: { id: true, name: true, internalCode: true } } },
      orderBy: { date: 'desc' },
    });
    res.json(items);
  } catch (e) {
    next(e);
  }
});

/** Resumen: totales por moneda, por categoría y por mes (últimos 12 meses). */
router.get('/stats', async (req, res, next) => {
  try {
    const { from, to, currency } = req.query as Record<string, string | undefined>;
    const where: Record<string, unknown> = {};
    const dateRange = buildDateRange(from, to);
    if (dateRange) where.date = dateRange;
    if (currency) where.currency = currency;

    const items = await prisma.expense.findMany({
      where,
      select: { amount: true, currency: true, category: true, date: true },
    });

    const byCurrency: Record<string, number> = {};
    const byCategory: Record<string, Record<string, number>> = {};
    const byMonth: Record<string, Record<string, number>> = {};

    for (const e of items) {
      const amt = Number(e.amount);
      byCurrency[e.currency] = (byCurrency[e.currency] || 0) + amt;
      byCategory[e.category] = byCategory[e.category] || {};
      byCategory[e.category][e.currency] = (byCategory[e.category][e.currency] || 0) + amt;
      const monthKey = `${e.date.getFullYear()}-${String(e.date.getMonth() + 1).padStart(2, '0')}`;
      byMonth[monthKey] = byMonth[monthKey] || {};
      byMonth[monthKey][e.currency] = (byMonth[monthKey][e.currency] || 0) + amt;
    }

    res.json({ count: items.length, byCurrency, byCategory, byMonth });
  } catch (e) {
    next(e);
  }
});

/** Exportar gastos a Excel (respeta filtros). */
router.get('/export', requirePermission('finance.export'), async (req, res, next) => {
  try {
    const { from, to, category, deviceId, currency } = req.query as Record<string, string | undefined>;
    const where: Record<string, unknown> = {};
    const dateRange = buildDateRange(from, to);
    if (dateRange) where.date = dateRange;
    if (category) where.category = category as ExpenseCategory;
    if (deviceId) where.deviceId = deviceId;
    if (currency) where.currency = currency;
    const items = await prisma.expense.findMany({
      where,
      include: { device: { select: { name: true, internalCode: true } } },
      orderBy: { date: 'desc' },
    });
    const rows = items.map((e) => ({
      Fecha: e.date.toISOString().slice(0, 10),
      Categoría: CATEGORY_LABELS[e.category] ?? e.category,
      Descripción: e.description,
      Monto: Number(e.amount),
      Moneda: e.currency,
      Proveedor: e.supplier ?? '',
      'N° Factura': e.invoiceNumber ?? '',
      'Método de pago': e.paymentMethod ?? '',
      Equipo: e.device ? `${e.device.internalCode} - ${e.device.name}` : '',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Gastos');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="gastos.xlsx"');
    res.send(buf);
  } catch (e) {
    next(e);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const item = await prisma.expense.findUnique({
      where: { id: req.params.id },
      include: { device: { select: { id: true, name: true, internalCode: true } } },
    });
    if (!item) throw new AppError(404, 'Gasto no encontrado');
    res.json(item);
  } catch (e) {
    next(e);
  }
});

router.post('/', requirePermission('finance.manage'), async (req: AuthRequest, res, next) => {
  try {
    const parsed = createExpenseSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError(400, parsed.error.errors[0]?.message || 'Datos inválidos');
    const d = parsed.data;
    const item = await prisma.expense.create({
      data: {
        date: new Date(d.date as string),
        amount: d.amount,
        currency: d.currency,
        category: d.category as ExpenseCategory,
        description: d.description,
        supplier: d.supplier || null,
        invoiceNumber: d.invoiceNumber || null,
        paymentMethod: d.paymentMethod || null,
        deviceId: d.deviceId || null,
        receiptUrl: d.receiptUrl || null,
        userId: req.user!.userId,
      },
    });
    await writeAudit(req, 'Expense', item.id, 'CREATE', { amount: d.amount, currency: d.currency, category: d.category });
    res.status(201).json(item);
  } catch (e) {
    next(e);
  }
});

router.patch('/:id', requirePermission('finance.manage'), async (req: AuthRequest, res, next) => {
  try {
    const parsed = updateExpenseSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError(400, parsed.error.errors[0]?.message || 'Datos inválidos');
    const d = parsed.data;
    const update: Record<string, unknown> = { ...d };
    if (d.date != null) update.date = new Date(d.date as string);
    if (d.deviceId !== undefined) update.deviceId = d.deviceId || null;
    const item = await prisma.expense.update({
      where: { id: req.params.id },
      data: update as Parameters<typeof prisma.expense.update>[0]['data'],
    });
    await writeAudit(req, 'Expense', item.id, 'UPDATE', d);
    res.json(item);
  } catch (e) {
    next(e);
  }
});

router.delete('/:id', requirePermission('finance.manage'), async (req: AuthRequest, res, next) => {
  try {
    await prisma.expense.delete({ where: { id: req.params.id } });
    await writeAudit(req, 'Expense', req.params.id, 'DELETE');
    res.status(204).send();
  } catch (e) {
    next(e);
  }
});

export default router;
