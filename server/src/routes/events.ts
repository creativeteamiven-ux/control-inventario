import { Router } from 'express';
import { PrismaClient, EventPhase, EventStatus, MovementType } from '@prisma/client';
import { AppError } from '../middleware/errorHandler.js';
import { authenticate, AuthRequest, requirePermission } from '../middleware/auth.js';
import { assertLocationCode } from '../lib/locations.js';
import { writeAudit } from '../lib/audit.js';

const router = Router();
const prisma = new PrismaClient();

router.use(authenticate);

const eventInclude = {
  items: {
    orderBy: { sortOrder: 'asc' as const },
    include: {
      device: {
        select: {
          id: true,
          name: true,
          brand: true,
          model: true,
          internalCode: true,
          serialNumber: true,
          location: true,
          status: true,
          images: { orderBy: { order: 'asc' as const }, take: 1 },
        },
      },
    },
  },
};

function parseEventDate(raw: unknown): Date {
  const d = new Date(String(raw));
  if (isNaN(d.getTime())) throw new AppError(400, 'Fecha del evento inválida');
  return d;
}

function eventStats(items: { outboundScannedAt: Date | null; inboundScannedAt: Date | null }[]) {
  const total = items.length;
  const outboundDone = items.filter((i) => i.outboundScannedAt).length;
  const inboundDone = items.filter((i) => i.inboundScannedAt).length;
  return { total, outboundDone, inboundDone, outboundPending: total - outboundDone, inboundPending: total - inboundDone };
}

async function findDeviceByCode(code: string) {
  let raw = code.trim();
  if (!raw) return null;
  const urlMatch = raw.match(/\/(?:device|inventory)\/([^/?#]+)/i);
  if (urlMatch) raw = decodeURIComponent(urlMatch[1]);
  return prisma.device.findFirst({
    where: {
      deletedAt: null,
      OR: [{ id: raw }, { internalCode: { equals: raw } }, { serialNumber: { equals: raw } }],
    },
  });
}

function mapEventResponse(event: Awaited<ReturnType<typeof loadEvent>>) {
  if (!event) return null;
  const stats = eventStats(event.items);
  return { ...event, stats };
}

async function loadEvent(id: string) {
  return prisma.event.findUnique({ where: { id }, include: eventInclude });
}

/** Listar eventos */
router.get('/', requirePermission('events.view'), async (req, res, next) => {
  try {
    const status = req.query.status as EventStatus | undefined;
    const where: { status?: EventStatus } = {};
    if (status) where.status = status;
    const events = await prisma.event.findMany({
      where,
      orderBy: [{ eventDate: 'desc' }, { createdAt: 'desc' }],
      include: {
        items: { select: { id: true, outboundScannedAt: true, inboundScannedAt: true } },
      },
    });
    res.json(
      events.map((e) => ({
        ...e,
        stats: eventStats(e.items),
        items: undefined,
      }))
    );
  } catch (e) {
    next(e);
  }
});

/** Crear evento */
router.post('/', requirePermission('events.manage'), async (req: AuthRequest, res, next) => {
  try {
    const { name, eventDate, fromLocation, toLocation, notes, deviceIds } = req.body as {
      name?: string;
      eventDate?: string;
      fromLocation?: string;
      toLocation?: string;
      notes?: string;
      deviceIds?: string[];
    };
    if (!name?.trim()) throw new AppError(400, 'Indica el nombre del evento');
    const from = await assertLocationCode(prisma, fromLocation ?? 'STORAGE_ROOM');
    const to = await assertLocationCode(prisma, toLocation ?? 'MAIN_AUDITORIUM');
    const event = await prisma.event.create({
      data: {
        name: name.trim(),
        eventDate: parseEventDate(eventDate ?? new Date()),
        fromLocation: from,
        toLocation: to,
        notes: notes?.trim() || null,
        createdBy: req.user!.userId,
        items: deviceIds?.length
          ? {
              create: deviceIds.map((deviceId, i) => ({ deviceId, sortOrder: i })),
            }
          : undefined,
      },
      include: eventInclude,
    });
    await writeAudit(req, 'Event', event.id, 'CREATE', { name: event.name });
    res.status(201).json(mapEventResponse(event));
  } catch (e) {
    next(e);
  }
});

/** Detalle de evento (polling para varios escaneadores) */
router.get('/:id', requirePermission('events.view'), async (req, res, next) => {
  try {
    const event = await loadEvent(req.params.id);
    if (!event) throw new AppError(404, 'Evento no encontrado');
    res.json(mapEventResponse(event));
  } catch (e) {
    next(e);
  }
});

/** Actualizar evento (solo DRAFT o ACTIVE) */
router.patch('/:id', requirePermission('events.manage'), async (req: AuthRequest, res, next) => {
  try {
    const existing = await prisma.event.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new AppError(404, 'Evento no encontrado');
    if (existing.status === 'COMPLETED' || existing.status === 'CANCELLED') {
      throw new AppError(400, 'No se puede editar un evento cerrado');
    }
    const { name, eventDate, fromLocation, toLocation, notes, currentPhase } = req.body as Record<string, string>;
    const data: Record<string, unknown> = {};
    if (name?.trim()) data.name = name.trim();
    if (eventDate) data.eventDate = parseEventDate(eventDate);
    if (fromLocation) data.fromLocation = await assertLocationCode(prisma, fromLocation);
    if (toLocation) data.toLocation = await assertLocationCode(prisma, toLocation);
    if (notes !== undefined) data.notes = notes?.trim() || null;
    if (currentPhase === 'OUTBOUND' || currentPhase === 'INBOUND') data.currentPhase = currentPhase;
    const event = await prisma.event.update({
      where: { id: req.params.id },
      data,
      include: eventInclude,
    });
    res.json(mapEventResponse(event));
  } catch (e) {
    next(e);
  }
});

/** Activar evento (DRAFT → ACTIVE) */
router.post('/:id/activate', requirePermission('events.manage'), async (req: AuthRequest, res, next) => {
  try {
    const existing = await loadEvent(req.params.id);
    if (!existing) throw new AppError(404, 'Evento no encontrado');
    if (existing.status !== 'DRAFT') throw new AppError(400, 'Solo se activan eventos en borrador');
    if (existing.items.length === 0) throw new AppError(400, 'Agrega al menos un equipo a la lista');
    const event = await prisma.event.update({
      where: { id: req.params.id },
      data: { status: 'ACTIVE', currentPhase: 'OUTBOUND' },
      include: eventInclude,
    });
    await writeAudit(req, 'Event', event.id, 'UPDATE', { status: 'ACTIVE' });
    res.json(mapEventResponse(event));
  } catch (e) {
    next(e);
  }
});

/** Agregar equipos a la lista */
router.post('/:id/items', requirePermission('events.manage'), async (req: AuthRequest, res, next) => {
  try {
    const existing = await prisma.event.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new AppError(404, 'Evento no encontrado');
    if (existing.status === 'COMPLETED' || existing.status === 'CANCELLED') {
      throw new AppError(400, 'No se puede modificar un evento cerrado');
    }
    const { deviceIds } = req.body as { deviceIds?: string[] };
    if (!deviceIds?.length) throw new AppError(400, 'Indica los equipos a agregar');
    const maxOrder = await prisma.eventItem.aggregate({
      where: { eventId: req.params.id },
      _max: { sortOrder: true },
    });
    let order = (maxOrder._max.sortOrder ?? -1) + 1;
    for (const deviceId of deviceIds) {
      const device = await prisma.device.findFirst({ where: { id: deviceId, deletedAt: null } });
      if (!device) continue;
      await prisma.eventItem.upsert({
        where: { eventId_deviceId: { eventId: req.params.id, deviceId } },
        create: { eventId: req.params.id, deviceId, sortOrder: order++ },
        update: {},
      });
    }
    const event = await loadEvent(req.params.id);
    res.json(mapEventResponse(event));
  } catch (e) {
    next(e);
  }
});

/** Quitar equipo de la lista */
router.delete('/:id/items/:itemId', requirePermission('events.manage'), async (req, res, next) => {
  try {
    const item = await prisma.eventItem.findFirst({
      where: { id: req.params.itemId, eventId: req.params.id },
    });
    if (!item) throw new AppError(404, 'Ítem no encontrado');
    await prisma.eventItem.delete({ where: { id: item.id } });
    const event = await loadEvent(req.params.id);
    res.json(mapEventResponse(event));
  } catch (e) {
    next(e);
  }
});

/** Escanear código de barras en checklist (multi-usuario) */
router.post('/:id/scan', requirePermission('events.scan'), async (req: AuthRequest, res, next) => {
  try {
    const { code, phase: phaseRaw } = req.body as { code?: string; phase?: EventPhase };
    if (!code?.trim()) throw new AppError(400, 'Indica el código escaneado');
    const phase = phaseRaw === 'INBOUND' ? 'INBOUND' : 'OUTBOUND';

    const event = await prisma.event.findUnique({ where: { id: req.params.id } });
    if (!event) throw new AppError(404, 'Evento no encontrado');
    if (event.status !== 'ACTIVE') throw new AppError(400, 'El evento no está activo para escaneo');
    if (event.currentPhase !== phase) {
      throw new AppError(400, phase === 'OUTBOUND' ? 'La fase actual es regreso (entrada)' : 'La fase actual es salida');
    }

    const device = await findDeviceByCode(code);
    const userId = req.user!.userId;
    const dbUser = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
    const userName = dbUser?.name ?? req.user!.email;

    const logScan = async (opts: {
      deviceId: string;
      success: boolean;
      message: string;
      deviceLocation?: string;
    }) => {
      await prisma.eventScan.create({
        data: {
          eventId: event.id,
          deviceId: opts.deviceId,
          phase,
          userId,
          userName,
          success: opts.success,
          message: opts.message,
          deviceLocation: opts.deviceLocation ?? null,
        },
      });
    };

    if (!device) {
      return res.status(404).json({
        success: false,
        code: 'NOT_FOUND',
        message: 'No se encontró ningún equipo con ese código',
        scannedCode: code.trim(),
      });
    }

    const item = await prisma.eventItem.findUnique({
      where: { eventId_deviceId: { eventId: event.id, deviceId: device.id } },
    });

    if (!item) {
      await logScan({ deviceId: device.id, success: false, message: 'Equipo no está en la lista del evento', deviceLocation: device.location });
      return res.status(400).json({
        success: false,
        code: 'NOT_ON_LIST',
        message: 'Este equipo no está en la lista del evento',
        device: { id: device.id, name: device.name, internalCode: device.internalCode },
      });
    }

    if (phase === 'OUTBOUND') {
      if (device.location !== event.fromLocation) {
        await logScan({
          deviceId: device.id,
          success: false,
          message: `Ubicación incorrecta: esperado ${event.fromLocation}, actual ${device.location}`,
          deviceLocation: device.location,
        });
        return res.status(400).json({
          success: false,
          code: 'WRONG_LOCATION',
          message: `El equipo no está en el lugar de origen. Debe estar en "${event.fromLocation}" pero está en "${device.location}"`,
          device: { id: device.id, name: device.name, internalCode: device.internalCode, location: device.location },
          expectedLocation: event.fromLocation,
        });
      }
      if (item.outboundScannedAt) {
        return res.json({
          success: true,
          code: 'ALREADY_SCANNED',
          message: 'Este equipo ya fue verificado en la salida',
          device: { id: device.id, name: device.name, internalCode: device.internalCode },
          item,
        });
      }
      const updated = await prisma.$transaction([
        prisma.eventItem.update({
          where: { id: item.id },
          data: { outboundScannedAt: new Date(), outboundUserId: userId, outboundUserName: userName },
        }),
        prisma.device.update({ where: { id: device.id }, data: { lastCheckedAt: new Date() } }),
        prisma.eventScan.create({
          data: {
            eventId: event.id,
            deviceId: device.id,
            phase: 'OUTBOUND',
            userId,
            userName,
            success: true,
            message: 'Verificado en origen',
            deviceLocation: device.location,
          },
        }),
      ]);
      const fresh = await loadEvent(event.id);
      return res.json({
        success: true,
        code: 'OK',
        message: 'Equipo verificado — listo para salir',
        device: { id: device.id, name: device.name, internalCode: device.internalCode },
        item: updated[0],
        stats: fresh ? eventStats(fresh.items) : undefined,
      });
    }

    // INBOUND
    if (!item.outboundScannedAt && !item.outboundMovementId) {
      await logScan({ deviceId: device.id, success: false, message: 'No fue verificado en la salida', deviceLocation: device.location });
      return res.status(400).json({
        success: false,
        code: 'NOT_OUTBOUND',
        message: 'Este equipo no fue verificado en la salida del evento',
        device: { id: device.id, name: device.name, internalCode: device.internalCode },
      });
    }
    if (device.location !== event.toLocation) {
      await logScan({
        deviceId: device.id,
        success: false,
        message: `Ubicación incorrecta: esperado ${event.toLocation}, actual ${device.location}`,
        deviceLocation: device.location,
      });
      return res.status(400).json({
        success: false,
        code: 'WRONG_LOCATION',
        message: `El equipo no está en el lugar del evento. Debe estar en "${event.toLocation}" pero está en "${device.location}"`,
        device: { id: device.id, name: device.name, internalCode: device.internalCode, location: device.location },
        expectedLocation: event.toLocation,
      });
    }
    if (item.inboundScannedAt) {
      return res.json({
        success: true,
        code: 'ALREADY_SCANNED',
        message: 'Este equipo ya fue verificado en el regreso',
        device: { id: device.id, name: device.name, internalCode: device.internalCode },
        item,
      });
    }
    const updated = await prisma.$transaction([
      prisma.eventItem.update({
        where: { id: item.id },
        data: { inboundScannedAt: new Date(), inboundUserId: userId, inboundUserName: userName },
      }),
      prisma.device.update({ where: { id: device.id }, data: { lastCheckedAt: new Date() } }),
      prisma.eventScan.create({
        data: {
          eventId: event.id,
          deviceId: device.id,
          phase: 'INBOUND',
          userId,
          userName,
          success: true,
          message: 'Verificado en regreso',
          deviceLocation: device.location,
        },
      }),
    ]);
    const fresh = await loadEvent(event.id);
    return res.json({
      success: true,
      code: 'OK',
      message: 'Equipo verificado — listo para guardar',
      device: { id: device.id, name: device.name, internalCode: device.internalCode },
      item: updated[0],
      stats: fresh ? eventStats(fresh.items) : undefined,
    });
  } catch (e) {
    next(e);
  }
});

/** Confirmar salida: registra movimientos CHECK_OUT y traslada equipos al venue */
router.post('/:id/confirm-outbound', requirePermission('events.manage'), async (req: AuthRequest, res, next) => {
  try {
    const event = await loadEvent(req.params.id);
    if (!event) throw new AppError(404, 'Evento no encontrado');
    if (event.status !== 'ACTIVE' || event.currentPhase !== 'OUTBOUND') {
      throw new AppError(400, 'No está en fase de salida');
    }
    const pending = event.items.filter((i) => !i.outboundScannedAt);
    if (pending.length > 0) {
      throw new AppError(400, `Faltan ${pending.length} equipos por verificar antes de confirmar la salida`);
    }
    const userId = req.user!.userId;
    const reason = `Evento: ${event.name}`;
    let moved = 0;
    for (const item of event.items) {
      if (item.outboundMovementId) continue;
      const device = item.device;
      const movement = await prisma.$transaction(async (tx) => {
        const m = await tx.movement.create({
          data: {
            deviceId: device.id,
            type: MovementType.CHECK_OUT,
            fromLocation: event.fromLocation,
            toLocation: event.toLocation,
            reason,
            userId,
          },
        });
        await tx.device.update({ where: { id: device.id }, data: { location: event.toLocation } });
        await tx.eventItem.update({ where: { id: item.id }, data: { outboundMovementId: m.id } });
        return m;
      });
      if (movement) moved++;
    }
    const updated = await prisma.event.update({
      where: { id: event.id },
      data: { currentPhase: 'INBOUND' },
      include: eventInclude,
    });
    await writeAudit(req, 'Event', event.id, 'UPDATE', { confirmOutbound: true, moved });
    res.json({ ok: true, moved, event: mapEventResponse(updated) });
  } catch (e) {
    next(e);
  }
});

/** Confirmar regreso: registra CHECK_IN y devuelve equipos al origen */
router.post('/:id/confirm-inbound', requirePermission('events.manage'), async (req: AuthRequest, res, next) => {
  try {
    const event = await loadEvent(req.params.id);
    if (!event) throw new AppError(404, 'Evento no encontrado');
    if (event.status !== 'ACTIVE' || event.currentPhase !== 'INBOUND') {
      throw new AppError(400, 'No está en fase de regreso');
    }
    const pending = event.items.filter((i) => !i.inboundScannedAt);
    if (pending.length > 0) {
      throw new AppError(400, `Faltan ${pending.length} equipos por verificar antes de confirmar el regreso`);
    }
    const userId = req.user!.userId;
    const reason = `Regreso evento: ${event.name}`;
    let moved = 0;
    for (const item of event.items) {
      if (item.inboundMovementId) continue;
      const device = item.device;
      await prisma.$transaction(async (tx) => {
        const m = await tx.movement.create({
          data: {
            deviceId: device.id,
            type: MovementType.CHECK_IN,
            fromLocation: event.toLocation,
            toLocation: event.fromLocation,
            reason,
            userId,
          },
        });
        await tx.device.update({ where: { id: device.id }, data: { location: event.fromLocation } });
        await tx.eventItem.update({ where: { id: item.id }, data: { inboundMovementId: m.id } });
      });
      moved++;
    }
    const updated = await prisma.event.update({
      where: { id: event.id },
      data: { status: 'COMPLETED' },
      include: eventInclude,
    });
    await writeAudit(req, 'Event', event.id, 'UPDATE', { confirmInbound: true, moved, status: 'COMPLETED' });
    res.json({ ok: true, moved, event: mapEventResponse(updated) });
  } catch (e) {
    next(e);
  }
});

/** Cancelar evento en borrador */
router.delete('/:id', requirePermission('events.manage'), async (req: AuthRequest, res, next) => {
  try {
    const event = await prisma.event.findUnique({ where: { id: req.params.id } });
    if (!event) throw new AppError(404, 'Evento no encontrado');
    if (event.status === 'ACTIVE') throw new AppError(400, 'No se puede eliminar un evento activo');
    await prisma.event.delete({ where: { id: req.params.id } });
    await writeAudit(req, 'Event', req.params.id, 'DELETE', {});
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

export default router;
