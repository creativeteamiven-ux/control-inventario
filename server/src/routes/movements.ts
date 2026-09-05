import { Router } from 'express';
import { createMovementSchema } from '@soundvault/shared';
import { MovementStatus, type MovementType } from '@prisma/client';
import { AppError } from '../middleware/errorHandler.js';
import { authenticate, AuthRequest, requirePermission } from '../middleware/auth.js';
import { writeAudit } from '../lib/audit.js';
import { assertLocationCode, isTemporaryLocation } from '../lib/locations.js';
import { prisma } from '../lib/prisma.js';

const router = Router();
router.use(authenticate);

type MovementPayload = { deviceId: string; type: string; reason: string; fromLocation?: string; toLocation?: string };

async function resolveLoc(code: string | undefined, fallback: string) {
  if (!code) return fallback;
  if (isTemporaryLocation(code)) return code;
  return assertLocationCode(prisma, code);
}

/** Tras aprobar, avanza fase del evento si ya no quedan pendientes de esa fase. */
async function maybeAdvanceEvent(eventId: string | null | undefined, movementType: string) {
  if (!eventId) return;
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: { items: true },
  });
  if (!event || event.status !== 'ACTIVE') return;

  if (movementType === 'CHECK_OUT' && event.currentPhase === 'OUTBOUND') {
    const allSent = event.items.every((i) => i.outboundMovementId);
    if (!allSent || event.items.length === 0) return;
    const pending = await prisma.movement.count({
      where: { eventId, type: 'CHECK_OUT', status: 'PENDING' },
    });
    if (pending === 0) {
      await prisma.event.update({ where: { id: eventId }, data: { currentPhase: 'INBOUND' } });
    }
  }

  if (movementType === 'CHECK_IN' && event.currentPhase === 'INBOUND') {
    const allSent = event.items.every((i) => i.inboundMovementId);
    if (!allSent || event.items.length === 0) return;
    const pending = await prisma.movement.count({
      where: { eventId, type: 'CHECK_IN', status: 'PENDING' },
    });
    if (pending === 0) {
      await prisma.event.update({ where: { id: eventId }, data: { status: 'COMPLETED' } });
    }
  }
}

/** Crear movimientos (quedan aprobados e aplicados de inmediato) */
router.post('/', requirePermission('movements.create'), async (req: AuthRequest, res, next) => {
  try {
    const body = req.body as { movements?: MovementPayload[] } | MovementPayload;
    const list: MovementPayload[] = Array.isArray((body as { movements?: MovementPayload[] }).movements)
      ? (body as { movements: MovementPayload[] }).movements
      : body && typeof body === 'object' && 'deviceId' in body
        ? [body as MovementPayload]
        : [];
    if (list.length === 0) throw new AppError(400, 'Debe enviar al menos un movimiento');
    const userId = req.user!.userId;
    const results: { created: number; errors: { deviceId: string; message: string }[] } = { created: 0, errors: [] };

    for (const item of list) {
      const parsed = createMovementSchema.safeParse(item);
      if (!parsed.success) {
        results.errors.push({ deviceId: item.deviceId ?? '', message: parsed.error.errors[0]?.message ?? 'Datos inválidos' });
        continue;
      }
      const device = await prisma.device.findFirst({ where: { id: parsed.data.deviceId, deletedAt: null } });
      if (!device) {
        results.errors.push({ deviceId: parsed.data.deviceId, message: 'Equipo no encontrado' });
        continue;
      }
      try {
        const fromLocation = await resolveLoc(parsed.data.fromLocation, device.location);
        const toLocation = await resolveLoc(parsed.data.toLocation, fromLocation);
        await prisma.$transaction([
          prisma.movement.create({
            data: {
              deviceId: device.id,
              type: parsed.data.type as MovementType,
              status: MovementStatus.APPROVED,
              fromLocation,
              toLocation,
              reason: parsed.data.reason.trim(),
              userId,
              approvedBy: userId,
              approvedAt: new Date(),
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

    if (results.created > 0) await writeAudit(req, 'Movement', 'batch', 'CREATE', { created: results.created });
    res.status(201).json(results);
  } catch (e) {
    next(e);
  }
});

/** Pendientes de autorización (eventos / traslados) */
router.get('/pending', requirePermission('movements.view'), async (_req, res, next) => {
  try {
    const items = await prisma.movement.findMany({
      where: { status: 'PENDING' },
      include: {
        device: { select: { id: true, name: true, internalCode: true, location: true } },
        user: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: 'asc' },
      take: 200,
    });
    res.json({ items, total: items.length });
  } catch (e) {
    next(e);
  }
});

/** Aprobar varios pendientes a la vez */
router.post('/approve-batch', requirePermission('movements.create'), async (req: AuthRequest, res, next) => {
  try {
    const { ids } = req.body as { ids?: string[] };
    if (!ids?.length) throw new AppError(400, 'Indica los movimientos a aprobar');
    const userId = req.user!.userId;
    let approved = 0;
    const eventIds = new Set<string>();
    for (const id of ids) {
      const existing = await prisma.movement.findUnique({ where: { id } });
      if (!existing || existing.status !== 'PENDING' || !existing.toLocation) continue;
      await prisma.$transaction([
        prisma.movement.update({
          where: { id },
          data: { status: 'APPROVED', approvedBy: userId, approvedAt: new Date() },
        }),
        prisma.device.update({
          where: { id: existing.deviceId },
          data: { location: existing.toLocation },
        }),
      ]);
      if (existing.eventId) eventIds.add(existing.eventId);
      approved++;
      await maybeAdvanceEvent(existing.eventId, existing.type);
    }
    await writeAudit(req, 'Movement', 'batch', 'UPDATE', { approved, eventIds: [...eventIds] });
    res.json({ ok: true, approved });
  } catch (e) {
    next(e);
  }
});

/** Aprobar un movimiento pendiente → aplica ubicación */
router.post('/:id/approve', requirePermission('movements.create'), async (req: AuthRequest, res, next) => {
  try {
    const existing = await prisma.movement.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new AppError(404, 'Movimiento no encontrado');
    if (existing.status !== 'PENDING') throw new AppError(400, 'Este movimiento ya fue resuelto');
    if (!existing.toLocation) throw new AppError(400, 'El movimiento no tiene destino');

    const userId = req.user!.userId;
    await prisma.$transaction([
      prisma.movement.update({
        where: { id: existing.id },
        data: { status: 'APPROVED', approvedBy: userId, approvedAt: new Date() },
      }),
      prisma.device.update({
        where: { id: existing.deviceId },
        data: { location: existing.toLocation },
      }),
    ]);
    await maybeAdvanceEvent(existing.eventId, existing.type);
    await writeAudit(req, 'Movement', existing.id, 'UPDATE', { approved: true });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

/** Rechazar pendiente */
router.post('/:id/reject', requirePermission('movements.create'), async (req: AuthRequest, res, next) => {
  try {
    const existing = await prisma.movement.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new AppError(404, 'Movimiento no encontrado');
    if (existing.status !== 'PENDING') throw new AppError(400, 'Este movimiento ya fue resuelto');

    await prisma.movement.update({
      where: { id: existing.id },
      data: { status: 'REJECTED', rejectedAt: new Date() },
    });

    if (existing.eventId) {
      if (existing.type === 'CHECK_OUT') {
        await prisma.eventItem.updateMany({
          where: { eventId: existing.eventId, outboundMovementId: existing.id },
          data: { outboundMovementId: null },
        });
      } else if (existing.type === 'CHECK_IN') {
        await prisma.eventItem.updateMany({
          where: { eventId: existing.eventId, inboundMovementId: existing.id },
          data: { inboundMovementId: null },
        });
      }
    }

    await writeAudit(req, 'Movement', existing.id, 'UPDATE', { rejected: true });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

router.get('/', requirePermission('movements.view'), async (req, res, next) => {
  try {
    const type = req.query.type as string | undefined;
    const status = req.query.status as string | undefined;
    const userId = req.query.userId as string | undefined;
    const deviceId = req.query.deviceId as string | undefined;
    const from = req.query.from as string | undefined;
    const to = req.query.to as string | undefined;
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
    const where: Record<string, unknown> = {};
    if (type) where.type = type;
    if (status) where.status = status;
    else where.status = { not: 'PENDING' }; // historial sin pendientes
    if (userId) where.userId = userId;
    if (deviceId) where.deviceId = deviceId;
    const range: { gte?: Date; lte?: Date } = {};
    if (from) {
      const s = new Date(from);
      if (!isNaN(s.getTime())) range.gte = s;
    }
    if (to) {
      const e = new Date(to);
      if (!isNaN(e.getTime())) {
        e.setHours(23, 59, 59, 999);
        range.lte = e;
      }
    }
    if (range.gte || range.lte) where.createdAt = range;
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

router.delete('/:id', requirePermission('movements.create'), async (req: AuthRequest, res, next) => {
  try {
    const existing = await prisma.movement.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new AppError(404, 'Movimiento no encontrado');
    if (existing.status === 'PENDING') throw new AppError(400, 'Rechaza el pendiente en lugar de eliminarlo');
    await prisma.movement.delete({ where: { id: req.params.id } });
    await writeAudit(req, 'Movement', existing.id, 'DELETE', { deviceId: existing.deviceId, type: existing.type });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

export default router;
