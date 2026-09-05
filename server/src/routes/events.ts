import { Router } from 'express';
import { EventListKind, EventPhase, MovementStatus, MovementType } from '@prisma/client';
import { AppError } from '../middleware/errorHandler.js';
import { authenticate, AuthRequest, requirePermission } from '../middleware/auth.js';
import { assertLocationCode, locationDisplayName, resolveEventDestination, isTemporaryLocation } from '../lib/locations.js';
import { writeAudit } from '../lib/audit.js';
import { prisma } from '../lib/prisma.js';

const router = Router();
router.use(authenticate);

const deviceSelect = {
  id: true,
  name: true,
  brand: true,
  model: true,
  internalCode: true,
  serialNumber: true,
  location: true,
  status: true,
  categoryId: true,
  images: { orderBy: { order: 'asc' as const }, take: 1 },
};

const itemInclude = {
  device: { select: deviceSelect },
  list: { select: { id: true, name: true, kind: true, categoryId: true } },
};

const eventInclude = {
  lists: {
    orderBy: [{ sortOrder: 'asc' as const }, { createdAt: 'asc' as const }],
    include: {
      items: {
        orderBy: { sortOrder: 'asc' as const },
        include: itemInclude,
      },
    },
  },
  items: {
    orderBy: { sortOrder: 'asc' as const },
    include: itemInclude,
  },
};

function parseEventDate(raw: unknown): Date {
  const d = new Date(String(raw));
  if (isNaN(d.getTime())) throw new AppError(400, 'Fecha del evento inválida');
  return d;
}

function eventStats(items: { outboundScannedAt: Date | null; inboundScannedAt: Date | null; outboundMovementId?: string | null; inboundMovementId?: string | null }[]) {
  const total = items.length;
  const outboundDone = items.filter((i) => i.outboundScannedAt).length;
  const inboundDone = items.filter((i) => i.inboundScannedAt).length;
  const outboundSent = items.filter((i) => i.outboundMovementId).length;
  const inboundSent = items.filter((i) => i.inboundMovementId).length;
  return {
    total,
    outboundDone,
    inboundDone,
    outboundPending: total - outboundDone,
    inboundPending: total - inboundDone,
    outboundSent,
    inboundSent,
  };
}

function listStats(items: { outboundScannedAt: Date | null; inboundScannedAt: Date | null; outboundMovementId?: string | null; inboundMovementId?: string | null }[]) {
  return eventStats(items);
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

async function locationNames() {
  const list = await prisma.location.findMany({ select: { code: true, name: true } });
  return Object.fromEntries(list.map((l) => [l.code, l.name]));
}

async function loadEvent(id: string) {
  return prisma.event.findUnique({ where: { id }, include: eventInclude });
}

function mapEventResponse(event: Awaited<ReturnType<typeof loadEvent>>, nameMap?: Record<string, string>) {
  if (!event) return null;
  const stats = eventStats(event.items);
  const lists = event.lists.map((l) => ({
    ...l,
    stats: listStats(l.items),
  }));
  return {
    ...event,
    lists,
    stats,
    fromLocationLabel: locationDisplayName(event.fromLocation, nameMap),
    toLocationLabel: locationDisplayName(event.toLocation, nameMap),
    toLocationIsTemporary: isTemporaryLocation(event.toLocation),
  };
}

async function ensureListForEvent(eventId: string, listId?: string | null) {
  if (listId) {
    const list = await prisma.eventList.findFirst({ where: { id: listId, eventId } });
    if (!list) throw new AppError(404, 'Lista no encontrada en este evento');
    return list;
  }
  const existing = await prisma.eventList.findFirst({
    where: { eventId },
    orderBy: { sortOrder: 'asc' },
  });
  if (existing) return existing;
  return prisma.eventList.create({
    data: { eventId, name: 'Lista general', kind: 'CUSTOM', sortOrder: 0 },
  });
}

async function createDefaultList(eventId: string, name = 'Lista general') {
  return prisma.eventList.create({
    data: { eventId, name, kind: 'CUSTOM', sortOrder: 0 },
  });
}

/** Listar eventos */
router.get('/', requirePermission('events.view'), async (req, res, next) => {
  try {
    const status = req.query.status as string | undefined;
    const where: { status?: typeof status } = {};
    if (status) where.status = status;
    const events = await prisma.event.findMany({
      where: where as { status?: 'DRAFT' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED' },
      orderBy: [{ eventDate: 'desc' }, { createdAt: 'desc' }],
      include: {
        items: { select: { id: true, outboundScannedAt: true, inboundScannedAt: true, outboundMovementId: true, inboundMovementId: true } },
        lists: { select: { id: true, name: true } },
      },
    });
    const names = await locationNames();
    res.json(
      events.map((e) => ({
        ...e,
        stats: eventStats(e.items),
        listCount: e.lists.length,
        fromLocationLabel: locationDisplayName(e.fromLocation, names),
        toLocationLabel: locationDisplayName(e.toLocation, names),
        toLocationIsTemporary: isTemporaryLocation(e.toLocation),
        items: undefined,
        lists: undefined,
      }))
    );
  } catch (e) {
    next(e);
  }
});

/** Crear evento (con lista general inicial) */
router.post('/', requirePermission('events.manage'), async (req: AuthRequest, res, next) => {
  try {
    const { name, eventDate, fromLocation, toLocation, toLocationCustom, notes, deviceIds } = req.body as {
      name?: string;
      eventDate?: string;
      fromLocation?: string;
      toLocation?: string;
      toLocationCustom?: string;
      notes?: string;
      deviceIds?: string[];
    };
    if (!name?.trim()) throw new AppError(400, 'Indica el nombre del evento');
    const from = await assertLocationCode(prisma, fromLocation ?? 'STORAGE_ROOM');
    const to = await resolveEventDestination(prisma, { toLocation, toLocationCustom });
    const event = await prisma.event.create({
      data: {
        name: name.trim(),
        eventDate: parseEventDate(eventDate ?? new Date()),
        fromLocation: from,
        toLocation: to,
        notes: notes?.trim() || null,
        createdBy: req.user!.userId,
      },
    });
    const list = await createDefaultList(event.id);
    if (deviceIds?.length) {
      let order = 0;
      for (const deviceId of deviceIds) {
        const device = await prisma.device.findFirst({ where: { id: deviceId, deletedAt: null } });
        if (!device) continue;
        await prisma.eventItem.create({
          data: { eventId: event.id, listId: list.id, deviceId, sortOrder: order++ },
        });
      }
    }
    await writeAudit(req, 'Event', event.id, 'CREATE', { name: event.name });
    const full = await loadEvent(event.id);
    const names = await locationNames();
    res.status(201).json(mapEventResponse(full, names));
  } catch (e) {
    next(e);
  }
});

/** Detalle */
router.get('/:id', requirePermission('events.view'), async (req, res, next) => {
  try {
    const event = await loadEvent(req.params.id);
    if (!event) throw new AppError(404, 'Evento no encontrado');
    if (event.lists.length === 0) {
      await createDefaultList(event.id);
      const refreshed = await loadEvent(req.params.id);
      const names = await locationNames();
      return res.json(mapEventResponse(refreshed, names));
    }
    const names = await locationNames();
    res.json(mapEventResponse(event, names));
  } catch (e) {
    next(e);
  }
});

/** Actualizar evento */
router.patch('/:id', requirePermission('events.manage'), async (req: AuthRequest, res, next) => {
  try {
    const existing = await prisma.event.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new AppError(404, 'Evento no encontrado');
    if (existing.status === 'COMPLETED' || existing.status === 'CANCELLED') {
      throw new AppError(400, 'No se puede editar un evento cerrado');
    }
    const { name, eventDate, fromLocation, toLocation, toLocationCustom, notes, currentPhase } = req.body as Record<string, string>;
    const data: Record<string, unknown> = {};
    if (name?.trim()) data.name = name.trim();
    if (eventDate) data.eventDate = parseEventDate(eventDate);
    if (fromLocation) data.fromLocation = await assertLocationCode(prisma, fromLocation);
    if (toLocationCustom?.trim()) {
      data.toLocation = await resolveEventDestination(prisma, { toLocationCustom });
    } else if (toLocation) {
      data.toLocation = await resolveEventDestination(prisma, { toLocation });
    }
    if (notes !== undefined) data.notes = notes?.trim() || null;
    if (currentPhase === 'OUTBOUND' || currentPhase === 'INBOUND') data.currentPhase = currentPhase;
    await prisma.event.update({ where: { id: req.params.id }, data });
    const event = await loadEvent(req.params.id);
    const names = await locationNames();
    res.json(mapEventResponse(event, names));
  } catch (e) {
    next(e);
  }
});

/** Crear lista en el evento */
router.post('/:id/lists', requirePermission('events.manage'), async (req: AuthRequest, res, next) => {
  try {
    const event = await prisma.event.findUnique({ where: { id: req.params.id } });
    if (!event) throw new AppError(404, 'Evento no encontrado');
    if (event.status === 'COMPLETED' || event.status === 'CANCELLED') {
      throw new AppError(400, 'No se puede modificar un evento cerrado');
    }
    const { name, kind, categoryId, deviceIds } = req.body as {
      name?: string;
      kind?: EventListKind;
      categoryId?: string;
      deviceIds?: string[];
    };
    const listKind: EventListKind = kind === 'CATEGORY' ? 'CATEGORY' : 'CUSTOM';
    let listName = name?.trim() || '';
    if (listKind === 'CATEGORY') {
      if (!categoryId) throw new AppError(400, 'Indica la categoría');
      const cat = await prisma.category.findUnique({ where: { id: categoryId } });
      if (!cat) throw new AppError(404, 'Categoría no encontrada');
      listName = listName || cat.name;
    }
    if (!listName) throw new AppError(400, 'Indica el nombre de la lista');

    const maxOrder = await prisma.eventList.aggregate({ where: { eventId: event.id }, _max: { sortOrder: true } });
    const list = await prisma.eventList.create({
      data: {
        eventId: event.id,
        name: listName,
        kind: listKind,
        categoryId: listKind === 'CATEGORY' ? categoryId! : null,
        sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
      },
    });

    let ids = deviceIds ?? [];
    if (listKind === 'CATEGORY' && categoryId && ids.length === 0) {
      const devices = await prisma.device.findMany({
        where: { deletedAt: null, categoryId },
        select: { id: true },
        take: 500,
      });
      ids = devices.map((d) => d.id);
    }

    let order = 0;
    for (const deviceId of ids) {
      const device = await prisma.device.findFirst({ where: { id: deviceId, deletedAt: null } });
      if (!device) continue;
      await prisma.eventItem.upsert({
        where: { eventId_deviceId: { eventId: event.id, deviceId } },
        create: { eventId: event.id, listId: list.id, deviceId, sortOrder: order++ },
        update: { listId: list.id },
      });
    }

    await writeAudit(req, 'EventList', list.id, 'CREATE', { eventId: event.id, name: list.name });
    const full = await loadEvent(event.id);
    const names = await locationNames();
    res.status(201).json(mapEventResponse(full, names));
  } catch (e) {
    next(e);
  }
});

/** Editar lista (nombre) */
router.patch('/:id/lists/:listId', requirePermission('events.manage'), async (req: AuthRequest, res, next) => {
  try {
    const list = await prisma.eventList.findFirst({ where: { id: req.params.listId, eventId: req.params.id } });
    if (!list) throw new AppError(404, 'Lista no encontrada');
    const event = await prisma.event.findUnique({ where: { id: req.params.id } });
    if (!event || event.status === 'COMPLETED' || event.status === 'CANCELLED') {
      throw new AppError(400, 'No se puede editar esta lista');
    }
    const { name } = req.body as { name?: string };
    if (!name?.trim()) throw new AppError(400, 'Indica el nombre');
    await prisma.eventList.update({ where: { id: list.id }, data: { name: name.trim() } });
    const full = await loadEvent(req.params.id);
    const names = await locationNames();
    res.json(mapEventResponse(full, names));
  } catch (e) {
    next(e);
  }
});

/** Eliminar lista (y sus ítems) */
router.delete('/:id/lists/:listId', requirePermission('events.manage'), async (req: AuthRequest, res, next) => {
  try {
    const list = await prisma.eventList.findFirst({ where: { id: req.params.listId, eventId: req.params.id } });
    if (!list) throw new AppError(404, 'Lista no encontrada');
    const event = await prisma.event.findUnique({ where: { id: req.params.id } });
    if (!event || event.status === 'COMPLETED' || event.status === 'CANCELLED') {
      throw new AppError(400, 'No se puede eliminar esta lista');
    }
    const count = await prisma.eventList.count({ where: { eventId: req.params.id } });
    if (count <= 1) throw new AppError(400, 'Debe quedar al menos una lista en el evento');
    await prisma.eventList.delete({ where: { id: list.id } });
    const full = await loadEvent(req.params.id);
    const names = await locationNames();
    res.json(mapEventResponse(full, names));
  } catch (e) {
    next(e);
  }
});

/** Activar evento */
router.post('/:id/activate', requirePermission('events.manage'), async (req: AuthRequest, res, next) => {
  try {
    const existing = await loadEvent(req.params.id);
    if (!existing) throw new AppError(404, 'Evento no encontrado');
    if (existing.status !== 'DRAFT') throw new AppError(400, 'Solo se activan eventos en borrador');
    if (existing.items.length === 0) throw new AppError(400, 'Agrega al menos un equipo a alguna lista');
    await prisma.event.update({
      where: { id: req.params.id },
      data: { status: 'ACTIVE', currentPhase: 'OUTBOUND' },
    });
    await writeAudit(req, 'Event', req.params.id, 'UPDATE', { status: 'ACTIVE' });
    const event = await loadEvent(req.params.id);
    const names = await locationNames();
    res.json(mapEventResponse(event, names));
  } catch (e) {
    next(e);
  }
});

/** Agregar equipos a una lista */
router.post('/:id/items', requirePermission('events.manage'), async (req: AuthRequest, res, next) => {
  try {
    const existing = await prisma.event.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new AppError(404, 'Evento no encontrado');
    if (existing.status === 'COMPLETED' || existing.status === 'CANCELLED') {
      throw new AppError(400, 'No se puede modificar un evento cerrado');
    }
    const { deviceIds, listId } = req.body as { deviceIds?: string[]; listId?: string };
    if (!deviceIds?.length) throw new AppError(400, 'Indica los equipos a agregar');
    const list = await ensureListForEvent(req.params.id, listId);
    const maxOrder = await prisma.eventItem.aggregate({
      where: { eventId: req.params.id, listId: list.id },
      _max: { sortOrder: true },
    });
    let order = (maxOrder._max.sortOrder ?? -1) + 1;
    for (const deviceId of deviceIds) {
      const device = await prisma.device.findFirst({ where: { id: deviceId, deletedAt: null } });
      if (!device) continue;
      await prisma.eventItem.upsert({
        where: { eventId_deviceId: { eventId: req.params.id, deviceId } },
        create: { eventId: req.params.id, listId: list.id, deviceId, sortOrder: order++ },
        update: { listId: list.id },
      });
    }
    const event = await loadEvent(req.params.id);
    const names = await locationNames();
    res.json(mapEventResponse(event, names));
  } catch (e) {
    next(e);
  }
});

/** Quitar equipo */
router.delete('/:id/items/:itemId', requirePermission('events.manage'), async (req, res, next) => {
  try {
    const item = await prisma.eventItem.findFirst({
      where: { id: req.params.itemId, eventId: req.params.id },
    });
    if (!item) throw new AppError(404, 'Ítem no encontrado');
    await prisma.eventItem.delete({ where: { id: item.id } });
    const event = await loadEvent(req.params.id);
    const names = await locationNames();
    res.json(mapEventResponse(event, names));
  } catch (e) {
    next(e);
  }
});

/** Agregar por escaneo (borrador) */
router.post('/:id/add-by-scan', async (req: AuthRequest, res, next) => {
  try {
    const perms = req.user?.permissions ?? [];
    if (!perms.includes('events.manage') && !perms.includes('events.scan')) {
      throw new AppError(403, 'Sin permiso para agregar equipos al evento');
    }
    const { code, listId } = req.body as { code?: string; listId?: string };
    if (!code?.trim()) throw new AppError(400, 'Indica el código escaneado');

    const event = await prisma.event.findUnique({ where: { id: req.params.id } });
    if (!event) throw new AppError(404, 'Evento no encontrado');
    if (event.status !== 'DRAFT') {
      throw new AppError(400, 'Solo puedes agregar equipos escaneando en eventos en borrador');
    }

    const list = await ensureListForEvent(event.id, listId);
    const device = await findDeviceByCode(code);
    if (!device) {
      return res.status(404).json({
        success: false,
        code: 'NOT_FOUND',
        message: 'No se encontró ningún equipo con ese código',
      });
    }

    const existing = await prisma.eventItem.findUnique({
      where: { eventId_deviceId: { eventId: event.id, deviceId: device.id } },
    });
    if (existing) {
      if (existing.listId !== list.id) {
        await prisma.eventItem.update({ where: { id: existing.id }, data: { listId: list.id } });
      }
      const current = await loadEvent(event.id);
      return res.json({
        success: true,
        code: 'ALREADY_ON_LIST',
        message: existing.listId === list.id ? 'Este equipo ya está en la lista' : `Equipo movido a "${list.name}"`,
        device: { id: device.id, name: device.name, internalCode: device.internalCode },
        total: current ? eventStats(current.items).total : undefined,
      });
    }

    const maxOrder = await prisma.eventItem.aggregate({
      where: { eventId: event.id, listId: list.id },
      _max: { sortOrder: true },
    });
    await prisma.eventItem.create({
      data: {
        eventId: event.id,
        listId: list.id,
        deviceId: device.id,
        sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
      },
    });

    const updated = await loadEvent(event.id);
    const mapped = mapEventResponse(updated, await locationNames());
    res.json({
      success: true,
      code: 'ADDED',
      message: `${device.internalCode} agregado a "${list.name}"`,
      device: { id: device.id, name: device.name, internalCode: device.internalCode },
      stats: mapped?.stats,
      total: mapped?.stats?.total,
    });
  } catch (e) {
    next(e);
  }
});

/** Checklist por escaneo */
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

    const locNames = await locationNames();
    const toLabel = locationDisplayName(event.toLocation, locNames);

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
      await logScan({ deviceId: device.id, success: false, message: 'Equipo no está en ninguna lista del evento', deviceLocation: device.location });
      return res.status(400).json({
        success: false,
        code: 'NOT_ON_LIST',
        message: 'Este equipo no está en ninguna lista del evento',
        device: { id: device.id, name: device.name, internalCode: device.internalCode },
      });
    }

    if (phase === 'OUTBOUND') {
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
          data: {
            outboundScannedAt: new Date(),
            outboundUserId: userId,
            outboundUserName: userName,
            originLocation: device.location,
          },
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
            message: 'Verificado para salida',
            deviceLocation: device.location,
          },
        }),
      ]);
      const fresh = await loadEvent(event.id);
      return res.json({
        success: true,
        code: 'OK',
        message: 'Equipo verificado — listo para solicitar traslado',
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
        message: `El equipo debe estar en "${toLabel}" (tras autorizar el traslado de salida). En inventario figura en "${locationDisplayName(device.location, locNames)}".`,
        device: {
          id: device.id,
          name: device.name,
          internalCode: device.internalCode,
          location: device.location,
          locationLabel: locationDisplayName(device.location, locNames),
        },
        expectedLocation: event.toLocation,
        expectedLocationLabel: toLabel,
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
      message: 'Equipo verificado — listo para solicitar regreso',
      device: { id: device.id, name: device.name, internalCode: device.internalCode },
      item: updated[0],
      stats: fresh ? eventStats(fresh.items) : undefined,
    });
  } catch (e) {
    next(e);
  }
});

/**
 * Enviar verificados a Movimientos (PENDIENTE de autorización).
 * Reemplaza el traslado inmediato: el responsable aprueba en /movimientos.
 */
router.post('/:id/send-to-movements', requirePermission('events.manage'), async (req: AuthRequest, res, next) => {
  try {
    const event = await loadEvent(req.params.id);
    if (!event) throw new AppError(404, 'Evento no encontrado');
    if (event.status !== 'ACTIVE') throw new AppError(400, 'El evento no está activo');

    const { listId, phase: phaseRaw } = req.body as { listId?: string; phase?: EventPhase };
    const phase = phaseRaw === 'INBOUND' ? 'INBOUND' : event.currentPhase;
    if (event.currentPhase !== phase) {
      throw new AppError(400, `La fase actual del evento es ${event.currentPhase === 'OUTBOUND' ? 'salida' : 'regreso'}`);
    }

    let items = event.items;
    if (listId) {
      items = items.filter((i) => i.listId === listId);
      if (!items.length) throw new AppError(400, 'La lista no tiene equipos');
    }

    if (phase === 'OUTBOUND') {
      const pendingScan = items.filter((i) => !i.outboundScannedAt);
      if (pendingScan.length > 0) {
        throw new AppError(400, `Faltan ${pendingScan.length} equipos por verificar antes de enviar a movimientos`);
      }
    } else {
      const pendingScan = items.filter((i) => !i.inboundScannedAt);
      if (pendingScan.length > 0) {
        throw new AppError(400, `Faltan ${pendingScan.length} equipos por verificar antes de enviar el regreso`);
      }
    }

    const userId = req.user!.userId;
    const reasonBase = phase === 'OUTBOUND' ? `Evento (salida): ${event.name}` : `Evento (regreso): ${event.name}`;
    let created = 0;
    let skipped = 0;

    for (const item of items) {
      if (phase === 'OUTBOUND' && item.outboundMovementId) {
        skipped++;
        continue;
      }
      if (phase === 'INBOUND' && item.inboundMovementId) {
        skipped++;
        continue;
      }

      const listName = item.list?.name;
      const reason = listName ? `${reasonBase} · ${listName}` : reasonBase;
      const fromLocation =
        phase === 'OUTBOUND'
          ? item.originLocation || item.device.location || event.fromLocation
          : event.toLocation;
      const toLocation =
        phase === 'OUTBOUND' ? event.toLocation : item.originLocation || event.fromLocation;

      const movement = await prisma.movement.create({
        data: {
          deviceId: item.deviceId,
          type: phase === 'OUTBOUND' ? MovementType.CHECK_OUT : MovementType.CHECK_IN,
          status: MovementStatus.PENDING,
          fromLocation,
          toLocation,
          reason,
          userId,
          eventId: event.id,
          eventListId: item.listId,
        },
      });

      await prisma.eventItem.update({
        where: { id: item.id },
        data: phase === 'OUTBOUND' ? { outboundMovementId: movement.id } : { inboundMovementId: movement.id },
      });
      created++;
    }

    await writeAudit(req, 'Event', event.id, 'UPDATE', { sendToMovements: true, phase, created, listId });
    const full = await loadEvent(event.id);
    const names = await locationNames();
    res.json({
      ok: true,
      created,
      skipped,
      message:
        created > 0
          ? `${created} traslado(s) enviado(s) a Movimientos pendientes de autorización`
          : 'No hay traslados nuevos por enviar',
      event: mapEventResponse(full, names),
    });
  } catch (e) {
    next(e);
  }
});

/** Compat: confirm-outbound → envía a movimientos pendientes */
router.post('/:id/confirm-outbound', requirePermission('events.manage'), async (req: AuthRequest, res, next) => {
  try {
    req.body = { ...(typeof req.body === 'object' && req.body ? req.body : {}), phase: 'OUTBOUND' };
    const event = await loadEvent(req.params.id);
    if (!event) throw new AppError(404, 'Evento no encontrado');
    if (event.status !== 'ACTIVE' || event.currentPhase !== 'OUTBOUND') {
      throw new AppError(400, 'No está en fase de salida');
    }
    const pending = event.items.filter((i) => !i.outboundScannedAt);
    if (pending.length > 0) {
      throw new AppError(400, `Faltan ${pending.length} equipos por verificar antes de enviar a movimientos`);
    }
    const userId = req.user!.userId;
    let created = 0;
    for (const item of event.items) {
      if (item.outboundMovementId) continue;
      const m = await prisma.movement.create({
        data: {
          deviceId: item.deviceId,
          type: MovementType.CHECK_OUT,
          status: MovementStatus.PENDING,
          fromLocation: item.originLocation || item.device.location || event.fromLocation,
          toLocation: event.toLocation,
          reason: `Evento (salida): ${event.name}${item.list?.name ? ` · ${item.list.name}` : ''}`,
          userId,
          eventId: event.id,
          eventListId: item.listId,
        },
      });
      await prisma.eventItem.update({ where: { id: item.id }, data: { outboundMovementId: m.id } });
      created++;
    }
    await writeAudit(req, 'Event', event.id, 'UPDATE', { sendToMovements: true, phase: 'OUTBOUND', created });
    const full = await loadEvent(event.id);
    res.json({
      ok: true,
      created,
      moved: created,
      message: `${created} traslado(s) enviado(s) a Movimientos pendientes de autorización`,
      event: mapEventResponse(full, await locationNames()),
    });
  } catch (e) {
    next(e);
  }
});

/** Compat: confirm-inbound → envía regreso a movimientos */
router.post('/:id/confirm-inbound', requirePermission('events.manage'), async (req: AuthRequest, res, next) => {
  try {
    const event = await loadEvent(req.params.id);
    if (!event) throw new AppError(404, 'Evento no encontrado');
    if (event.status !== 'ACTIVE' || event.currentPhase !== 'INBOUND') {
      throw new AppError(400, 'No está en fase de regreso');
    }
    const pending = event.items.filter((i) => !i.inboundScannedAt);
    if (pending.length > 0) throw new AppError(400, `Faltan ${pending.length} equipos por verificar`);

    const userId = req.user!.userId;
    let created = 0;
    for (const item of event.items) {
      if (item.inboundMovementId) continue;
      const m = await prisma.movement.create({
        data: {
          deviceId: item.deviceId,
          type: MovementType.CHECK_IN,
          status: MovementStatus.PENDING,
          fromLocation: event.toLocation,
          toLocation: item.originLocation || event.fromLocation,
          reason: `Evento (regreso): ${event.name}${item.list?.name ? ` · ${item.list.name}` : ''}`,
          userId,
          eventId: event.id,
          eventListId: item.listId,
        },
      });
      await prisma.eventItem.update({ where: { id: item.id }, data: { inboundMovementId: m.id } });
      created++;
    }
    await writeAudit(req, 'Event', event.id, 'UPDATE', { sendToMovements: true, phase: 'INBOUND', created });
    const full = await loadEvent(event.id);
    res.json({
      ok: true,
      created,
      moved: created,
      message: `${created} regreso(s) enviado(s) a Movimientos pendientes de autorización`,
      event: mapEventResponse(full, await locationNames()),
    });
  } catch (e) {
    next(e);
  }
});

/** Eliminar evento */
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
