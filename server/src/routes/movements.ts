import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/auth.js';

const router = Router();
const prisma = new PrismaClient();

router.use(authenticate);

router.get('/', async (req, res, next) => {
  try {
    const type = req.query.type as string | undefined;
    const userId = req.query.userId as string | undefined;
    const deviceId = req.query.deviceId as string | undefined;
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
    const where: Record<string, unknown> = {};
    if (type) where.type = type;
    if (userId) where.userId = userId;
    if (deviceId) where.deviceId = deviceId;
    const [items, total] = await Promise.all([
      prisma.movement.findMany({
        where,
        include: {
          device: { select: { id: true, name: true, internalCode: true } },
          user: { select: { name: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.movement.count({ where }),
    ]);
    res.json({ items, total, page, limit });
  } catch (e) {
    next(e);
  }
});

export default router;
