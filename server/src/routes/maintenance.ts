import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { createMaintenanceSchema, updateMaintenanceSchema } from '@soundvault/shared';
import { AppError } from '../middleware/errorHandler.js';
import { authenticate, AuthRequest, requireRole } from '../middleware/auth.js';
import { stripCostFromResponse } from '../lib/permissions.js';

const router = Router();
const prisma = new PrismaClient();

router.use(authenticate);

router.get('/', async (req, res, next) => {
  try {
    const status = req.query.status as string | undefined;
    const deviceId = req.query.deviceId as string | undefined;
    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (deviceId) where.deviceId = deviceId;
    const items = await prisma.maintenance.findMany({
      where,
      include: {
        device: { select: { id: true, name: true, internalCode: true } },
        user: { select: { name: true } },
      },
      orderBy: { startDate: 'desc' },
    });
    const perms = (req as AuthRequest).user?.permissions ?? [];
    res.json(stripCostFromResponse(items, perms));
  } catch (e) {
    next(e);
  }
});

router.get('/stats', async (req, res, next) => {
  try {
    const [scheduled, inProgress, completed, totalCost] = await Promise.all([
      prisma.maintenance.count({ where: { status: 'SCHEDULED' } }),
      prisma.maintenance.count({ where: { status: 'IN_PROGRESS' } }),
      prisma.maintenance.count({ where: { status: 'COMPLETED' } }),
      prisma.maintenance.aggregate({
        where: { status: 'COMPLETED' },
        _sum: { cost: true },
      }),
    ]);
    res.json({ scheduled, inProgress, completed, totalCost: Number(totalCost._sum.cost || 0) });
  } catch (e) {
    next(e);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const item = await prisma.maintenance.findUnique({
      where: { id: req.params.id },
      include: {
        device: true,
        user: { select: { name: true, email: true } },
      },
    });
    if (!item) throw new AppError(404, 'Mantenimiento no encontrado');
    res.json(item);
  } catch (e) {
    next(e);
  }
});

router.post('/', requireRole('ADMIN', 'MANAGER', 'TECHNICIAN'), async (req: AuthRequest, res, next) => {
  try {
    const parsed = createMaintenanceSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError(400, parsed.error.errors[0]?.message || 'Datos inválidos');
    const data = {
      ...parsed.data,
      startDate: new Date(parsed.data.startDate as string),
      endDate: parsed.data.endDate ? new Date(parsed.data.endDate as string) : null,
      userId: req.user!.userId,
    };
    const item = await prisma.maintenance.create({
      data: data as Parameters<typeof prisma.maintenance.create>[0]['data'],
      include: { device: true },
    });
    res.status(201).json(item);
  } catch (e) {
    next(e);
  }
});

router.patch('/:id', requireRole('ADMIN', 'MANAGER', 'TECHNICIAN'), async (req, res, next) => {
  try {
    const parsed = updateMaintenanceSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError(400, parsed.error.errors[0]?.message || 'Datos inválidos');
    const update: Record<string, unknown> = { ...parsed.data };
    if (parsed.data.startDate != null) update.startDate = new Date(parsed.data.startDate as string);
    if (parsed.data.endDate != null) update.endDate = new Date(parsed.data.endDate as string);
    const item = await prisma.maintenance.update({
      where: { id: req.params.id },
      data: update as Parameters<typeof prisma.maintenance.update>[0]['data'],
      include: { device: true },
    });
    res.json(item);
  } catch (e) {
    next(e);
  }
});

router.delete('/:id', requireRole('ADMIN'), async (req, res, next) => {
  try {
    await prisma.maintenance.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (e) {
    next(e);
  }
});

export default router;
