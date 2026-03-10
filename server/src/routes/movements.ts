import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { createMovementSchema } from '@soundvault/shared';
import type { DeviceLocation, MovementType } from '@prisma/client';
import { AppError } from '../middleware/errorHandler.js';
import { authenticate, AuthRequest, requireRole } from '../middleware/auth.js';

const router = Router();
const prisma = new PrismaClient();

router.use(authenticate);

/** Crear uno o más movimientos desde la página (sin importar Excel) */
router.post('/', requireRole('ADMIN', 'MANAGER', 'TECHNICIAN'), async (req: AuthRequest, res, next) => {
  try {
    const body = req.body as { movements?: Array<{ deviceId: string; type: string; reason: string; fromLocation?: string; toLocation?: string }> };
    const list = Array.isArray(body?.movements) ? body.movements : [body];
    if (list.length === 0) throw new AppError(400, 'Debe enviar al menos un movimiento');
    const userId = req.user!.userId;
    const results: { created: number; errors: { deviceId: string; message: string }[] } = { created: 0, errors: [] };

    for (const item of list) {
      const parsed = createMovementSchema.safeParse(item);
      if (!parsed.success) {
        results.errors.push({ deviceId: item?.deviceId ?? '', message: parsed.error.errors[0]?.message ?? 'Datos inválidos' });
        continue;
      }
      const device = await prisma.device.findFirst({ where: { id: parsed.data.deviceId, deletedAt: null } });
      if (!device) {
        results.errors.push({ deviceId: parsed.data.deviceId, message: 'Equipo no encontrado' });
        continue;
      }
      const fromLocation: DeviceLocation = parsed.data.fromLocation ?? device.location;
      const toLocation: DeviceLocation = parsed.data.toLocation ?? fromLocation;

      try {
        await prisma.$transaction([
          prisma.movement.create({
            data: {
              deviceId: device.id,
              type: parsed.data.type as MovementType,
              fromLocation,
              toLocation,
              reason: parsed.data.reason.trim(),
              userId,
            },
          }),
          prisma.device.update({
            where: { id: device.id },
            data: { location: toLocation },
          }),
        ]);
        results.created++;
      } catch (err) {
        results.errors.push({ deviceId: device.id, message: (err as Error).message });
      }
    }

    res.status(201).json(results);
  } catch (e) {
    next(e);
  }
});

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
