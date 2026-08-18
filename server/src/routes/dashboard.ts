import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { canViewCost } from '../lib/permissions.js';
import { locationNameMap } from '../lib/locations.js';

const router = Router();
const prisma = new PrismaClient();

router.use(authenticate);

router.get('/stats', async (req, res, next) => {
  try {
    const [total, active, maintenance, loaned, totalValue, byCategory, byStatus, byLocation, lowCondition, overdueLoans] = await Promise.all([
      prisma.device.count({ where: { deletedAt: null } }),
      prisma.device.count({ where: { status: 'ACTIVE', deletedAt: null } }),
      prisma.device.count({ where: { status: 'MAINTENANCE', deletedAt: null } }),
      prisma.device.count({ where: { status: 'LOANED', deletedAt: null } }),
      prisma.device.aggregate({
        where: { deletedAt: null },
        _sum: { purchasePrice: true },
      }),
      prisma.device.groupBy({
        by: ['categoryId'],
        where: { deletedAt: null, categoryId: { not: null } },
        _count: true,
      }),
      prisma.device.groupBy({
        by: ['status'],
        where: { deletedAt: null },
        _count: true,
      }),
      prisma.device.groupBy({
        by: ['location'],
        where: { deletedAt: null },
        _count: true,
      }),
      prisma.device.count({ where: { deletedAt: null, condition: { lt: 70 } } }),
      prisma.loanRecord.count({ where: { status: 'ACTIVE', expectedReturn: { lt: new Date() } } }),
    ]);

    const locNames = await locationNameMap(prisma);
    const locationStats = byLocation.map((l) => ({
      location: l.location,
      name: locNames[l.location] ?? String(l.location).replace(/_/g, ' '),
      count: l._count,
    }));

    const categoryIds = byCategory.map((c) => c.categoryId).filter((id): id is string => !!id);
    const categories = await prisma.category.findMany({
      where: { id: { in: categoryIds } },
      select: { id: true, name: true, color: true },
    });
    const categoryMap = Object.fromEntries(categories.map((c) => [c.id, c]));
    const categoryStats = byCategory
      .filter((c): c is typeof c & { categoryId: string } => !!c.categoryId)
      .map((c) => ({
        categoryId: c.categoryId,
        categoryName: categoryMap[c.categoryId]?.name || 'Sin nombre',
        color: categoryMap[c.categoryId]?.color || '#64748b',
        count: c._count,
      }));

    const statusStats = byStatus.map((s) => ({ status: s.status, count: s._count }));

    const perms = (req as AuthRequest).user?.permissions ?? [];
    res.json({
      total,
      active,
      maintenance,
      loaned,
      ...(canViewCost(perms) && { totalValue: Number(totalValue._sum.purchasePrice || 0) }),
      byCategory: categoryStats,
      byStatus: statusStats,
      byLocation: locationStats,
      lowCondition,
      overdueLoans,
    });
  } catch (e) {
    next(e);
  }
});

export default router;
