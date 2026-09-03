import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth.js';

import { prisma } from '../lib/prisma.js';

const router = Router();

router.use(authenticate);
// El registro de auditoría es sensible: solo ADMIN y MANAGER.
router.use(requireRole('ADMIN', 'MANAGER'));

router.get('/', async (req, res, next) => {
  try {
    const entity = req.query.entity as string | undefined;
    const action = req.query.action as string | undefined;
    const userEmail = req.query.userEmail as string | undefined;
    const from = req.query.from as string | undefined;
    const to = req.query.to as string | undefined;
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));

    const where: Record<string, unknown> = {};
    if (entity) where.entity = entity;
    if (action) where.action = action;
    if (userEmail) where.userEmail = { contains: userEmail };
    const range: { gte?: Date; lte?: Date } = {};
    if (from) { const s = new Date(from); if (!isNaN(s.getTime())) range.gte = s; }
    if (to) { const e = new Date(to); if (!isNaN(e.getTime())) { e.setHours(23, 59, 59, 999); range.lte = e; } }
    if (range.gte || range.lte) where.createdAt = range;

    const [items, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.auditLog.count({ where }),
    ]);

    res.json({ items, total, page, limit });
  } catch (e) {
    next(e);
  }
});

export default router;
