import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import type { ExpenseCategory } from '@prisma/client';
import { createBudgetSchema, updateBudgetSchema } from '@soundvault/shared';
import { AppError } from '../middleware/errorHandler.js';
import { authenticate, AuthRequest, requirePermission } from '../middleware/auth.js';
import { writeAudit } from '../lib/audit.js';

const router = Router();
const prisma = new PrismaClient();

router.use(authenticate);
router.use(requirePermission('finance.view'));

function periodRange(year: number, month?: number | null): { gte: Date; lte: Date } {
  if (month && month >= 1 && month <= 12) {
    const gte = new Date(year, month - 1, 1, 0, 0, 0, 0);
    const lte = new Date(year, month, 0, 23, 59, 59, 999);
    return { gte, lte };
  }
  return { gte: new Date(year, 0, 1, 0, 0, 0, 0), lte: new Date(year, 11, 31, 23, 59, 59, 999) };
}

/** Listar presupuestos con el gasto real de cada período/categoría. */
router.get('/', async (req, res, next) => {
  try {
    const year = req.query.year ? Number(req.query.year) : undefined;
    const where: Record<string, unknown> = {};
    if (year) where.year = year;
    const budgets = await prisma.budget.findMany({
      where,
      orderBy: [{ year: 'desc' }, { month: 'asc' }],
    });

    const result = await Promise.all(
      budgets.map(async (b) => {
        const range = periodRange(b.year, b.month);
        const expenseWhere: Record<string, unknown> = { date: range, currency: b.currency };
        if (b.category) expenseWhere.category = b.category;
        const agg = await prisma.expense.aggregate({ where: expenseWhere, _sum: { amount: true } });
        const spent = Number(agg._sum.amount || 0);
        const amount = Number(b.amount);
        return {
          ...b,
          amount,
          spent,
          remaining: Math.round((amount - spent) * 100) / 100,
          percentUsed: amount > 0 ? Math.round((spent / amount) * 100) : 0,
        };
      })
    );
    res.json(result);
  } catch (e) {
    next(e);
  }
});

router.post('/', requirePermission('finance.manage'), async (req: AuthRequest, res, next) => {
  try {
    const parsed = createBudgetSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError(400, parsed.error.errors[0]?.message || 'Datos inválidos');
    const d = parsed.data;
    const item = await prisma.budget.create({
      data: {
        year: d.year,
        month: d.month ?? null,
        category: (d.category ?? null) as ExpenseCategory | null,
        amount: d.amount,
        currency: d.currency,
        note: d.note || null,
      },
    });
    await writeAudit(req, 'Budget', item.id, 'CREATE', { year: d.year, month: d.month, amount: d.amount });
    res.status(201).json(item);
  } catch (e) {
    next(e);
  }
});

router.patch('/:id', requirePermission('finance.manage'), async (req: AuthRequest, res, next) => {
  try {
    const parsed = updateBudgetSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError(400, parsed.error.errors[0]?.message || 'Datos inválidos');
    const d = parsed.data;
    const update: Record<string, unknown> = { ...d };
    if (d.category !== undefined) update.category = d.category ?? null;
    if (d.month !== undefined) update.month = d.month ?? null;
    const item = await prisma.budget.update({
      where: { id: req.params.id },
      data: update as Parameters<typeof prisma.budget.update>[0]['data'],
    });
    await writeAudit(req, 'Budget', item.id, 'UPDATE', d);
    res.json(item);
  } catch (e) {
    next(e);
  }
});

router.delete('/:id', requirePermission('finance.manage'), async (req: AuthRequest, res, next) => {
  try {
    await prisma.budget.delete({ where: { id: req.params.id } });
    await writeAudit(req, 'Budget', req.params.id, 'DELETE');
    res.status(204).send();
  } catch (e) {
    next(e);
  }
});

export default router;
