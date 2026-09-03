import { prisma } from '../lib/prisma.js';
import { Router } from 'express';
import { createMaintenanceSchema, updateMaintenanceSchema } from '@soundvault/shared';
import { AppError } from '../middleware/errorHandler.js';
import { authenticate, AuthRequest, requirePermission } from '../middleware/auth.js';
import { canViewCost, stripCostFromResponse } from '../lib/permissions.js';
import { writeAudit } from '../lib/audit.js';

const router = Router();

router.use(authenticate);

router.get('/', requirePermission('maintenance.view'), async (req, res, next) => {
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

router.get('/stats', requirePermission('maintenance.view'), async (req, res, next) => {
  try {
    const perms = (req as AuthRequest).user?.permissions ?? [];
    const [scheduled, inProgress, completed, totalCost] = await Promise.all([
      prisma.maintenance.count({ where: { status: 'SCHEDULED' } }),
      prisma.maintenance.count({ where: { status: 'IN_PROGRESS' } }),
      prisma.maintenance.count({ where: { status: 'COMPLETED' } }),
      canViewCost(perms)
        ? prisma.maintenance.aggregate({
            where: { status: 'COMPLETED' },
            _sum: { cost: true },
          })
        : Promise.resolve({ _sum: { cost: null } }),
    ]);
    res.json({
      scheduled,
      inProgress,
      completed,
      ...(canViewCost(perms) ? { totalCost: Number(totalCost._sum.cost || 0) } : {}),
    });
  } catch (e) {
    next(e);
  }
});

router.get('/:id', requirePermission('maintenance.view'), async (req, res, next) => {
  try {
    const item = await prisma.maintenance.findUnique({
      where: { id: req.params.id },
      include: {
        device: true,
        user: { select: { name: true, email: true } },
      },
    });
    if (!item) throw new AppError(404, 'Mantenimiento no encontrado');
    const perms = (req as AuthRequest).user?.permissions ?? [];
    res.json(stripCostFromResponse(item, perms));
  } catch (e) {
    next(e);
  }
});

router.post('/', requirePermission('maintenance.create'), async (req: AuthRequest, res, next) => {
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
    await writeAudit(req, 'Maintenance', item.id, 'CREATE', { deviceId: item.deviceId, type: item.type });
    res.status(201).json(item);
  } catch (e) {
    next(e);
  }
});

router.patch('/:id', requirePermission('maintenance.create'), async (req: AuthRequest, res, next) => {
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
    await writeAudit(req, 'Maintenance', item.id, 'UPDATE', parsed.data);
    res.json(item);
  } catch (e) {
    next(e);
  }
});

router.delete('/:id', requirePermission('maintenance.delete'), async (req: AuthRequest, res, next) => {
  try {
    await prisma.maintenance.delete({ where: { id: req.params.id } });
    await writeAudit(req, 'Maintenance', req.params.id, 'DELETE');
    res.status(204).send();
  } catch (e) {
    next(e);
  }
});

export default router;
