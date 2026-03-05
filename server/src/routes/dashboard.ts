import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { canViewCost } from '../lib/permissions.js';

const router = Router();
const prisma = new PrismaClient();

router.use(authenticate);

router.get('/stats', async (req, res, next) => {
  try {
    const [total, active, maintenance, loaned, totalValue, byCategory, byStatus] = await Promise.all([
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
        where: { deletedAt: null },
        _count: true,
      }),
      prisma.device.groupBy({
        by: ['status'],
        where: { deletedAt: null },
        _count: true,
      }),
    ]);

    const categories = await prisma.category.findMany({
      where: { id: { in: byCategory.map((c) => c.categoryId) } },
      select: { id: true, name: true, color: true },
    });
    const categoryMap = Object.fromEntries(categories.map((c) => [c.id, c]));
    const categoryStats = byCategory.map((c) => ({
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
    });
  } catch (e) {
    next(e);
  }
});

export default router;
