/**
 * Importaci?n masiva de equipos y traslados desde Excel
 */
import { Router } from 'express';
import multer from 'multer';
import * as XLSX from 'xlsx';
import { PrismaClient } from '@prisma/client';
import { AppError } from '../middleware/errorHandler.js';
import { authenticate, AuthRequest, requireRole } from '../middleware/auth.js';

const router = Router();
const prisma = new PrismaClient();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

router.use(authenticate);

function getNextInternalCode(prefix: string): Promise<string> {
  return prisma.device
    .findFirst({
      where: { internalCode: { startsWith: prefix } },
      orderBy: { internalCode: 'desc' },
    })
    .then((d) => {
      const num = d ? parseInt(String(d.internalCode).replace(prefix + '-', ''), 10) + 1 : 1;
      return `${prefix}-${String(num).padStart(3, '0')}`;
    });
}

type DeviceStatus = 'ACTIVE' | 'MAINTENANCE' | 'DAMAGED' | 'LOST' | 'RETIRED' | 'LOANED';
type DeviceLocation = 'MAIN_AUDITORIUM' | 'RECORDING_STUDIO' | 'STORAGE_ROOM' | 'YOUTH_ROOM' | 'CHAPEL' | 'ON_LOAN';

const STATUS_MAP: Record<string, DeviceStatus> = {
  ACTIVE: 'ACTIVE',
  OPERATIVO: 'ACTIVE',
  OPERATIVE: 'ACTIVE',
  MAINTENANCE: 'MAINTENANCE',
  'EN MANTENIMIENTO': 'MAINTENANCE',
  'EN_MANTENIMIENTO': 'MAINTENANCE',
  MANTENIMIENTO: 'MAINTENANCE',
  LOANED: 'LOANED',
  'EN PRÉSTAMO': 'LOANED',
  'EN_PRESTAMO': 'LOANED',
  PRESTAMO: 'LOANED',
  PRÉSTAMO: 'LOANED',
  DAMAGED: 'DAMAGED',
  DAÑADO: 'DAMAGED',
  DANADO: 'DAMAGED',
  LOST: 'LOST',
  EXTRAVIADO: 'LOST',
  RETIRED: 'RETIRED',
  'DADO DE BAJA': 'RETIRED',
  'DADO_DE_BAJA': 'RETIRED',
  BAJA: 'RETIRED',
};

const LOCATION_MAP: Record<string, DeviceLocation> = {
  MAIN_AUDITORIUM: 'MAIN_AUDITORIUM',
  AUDITORIO_PRINCIPAL: 'MAIN_AUDITORIUM',
  AUDITORIO: 'MAIN_AUDITORIUM',
  RECORDING_STUDIO: 'RECORDING_STUDIO',
  ESTUDIO_DE_GRABACION: 'RECORDING_STUDIO',
  ESTUDIO: 'RECORDING_STUDIO',
  STORAGE_ROOM: 'STORAGE_ROOM',
  ALMACEN: 'STORAGE_ROOM',
  CUARTO_DE_ALMACENAMIENTO: 'STORAGE_ROOM',
  YOUTH_ROOM: 'YOUTH_ROOM',
  SALON_DE_JOVENES: 'YOUTH_ROOM',
  CHAPEL: 'CHAPEL',
  CAPILLA: 'CHAPEL',
  ON_LOAN: 'ON_LOAN',
  EN_PRESTAMO: 'ON_LOAN',
};

function normalizeStatus(raw: string): DeviceStatus {
  const r = raw.trim();
  const key = r.toUpperCase().replace(/\s+/g, '_');
  const keyNoAccent = key.normalize('NFD').replace(/\u0300/g, '');
  return STATUS_MAP[key] ?? STATUS_MAP[keyNoAccent] ?? STATUS_MAP[r] ?? 'ACTIVE';
}

function normalizeLocation(raw: string): DeviceLocation {
  const r = raw.trim();
  const key = r.toUpperCase().replace(/\s+/g, '_').replace(/Ó/g, 'O').replace(/Í/g, 'I').replace(/É/g, 'E');
  return LOCATION_MAP[key] ?? LOCATION_MAP[r.toUpperCase().replace(/\s/g, '_')] ?? 'STORAGE_ROOM';
}

export type ValidationRow = {
  row: number;
  valid: boolean;
  errors: string[];
  corrections: { field: string; from: string; to: string }[];
};

export type ValidateDevicesResult = {
  headerErrors?: string;
  totalRows: number;
  validCount: number;
  invalidCount: number;
  rows: ValidationRow[];
};

function validateDeviceRows(
  rows: string[][],
  headers: string[],
  slugToId: Map<string, string>,
  categories: { id: string; slug: string; name: string }[]
): ValidateDevicesResult {
  const nameIdx = headers.findIndex((h) => /nombre/i.test(h));
  const brandIdx = headers.findIndex((h) => /marca/i.test(h));
  const modelIdx = headers.findIndex((h) => /modelo/i.test(h));
  const slugIdx = headers.findIndex((h) => /categoria|slug/i.test(h));
  const statusIdx = headers.findIndex((h) => /estado/i.test(h));
  const locIdx = headers.findIndex((h) => /ubicacion|ubicación/i.test(h));
  const priceIdx = headers.findIndex((h) => /precio/i.test(h));
  const condIdx = headers.findIndex((h) => /condicion|condición/i.test(h));

  const result: ValidateDevicesResult = { totalRows: Math.max(0, rows.length - 1), validCount: 0, invalidCount: 0, rows: [] };

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i] || [];
    const errors: string[] = [];
    const corrections: { field: string; from: string; to: string }[] = [];

    const name = String(row[nameIdx] ?? '').trim();
    const brand = String(row[brandIdx] ?? '').trim();
    const model = String(row[modelIdx] ?? '').trim();
    if (!name) errors.push('Nombre es obligatorio');
    if (!brand) errors.push('Marca es obligatoria');
    if (!model) errors.push('Modelo es obligatorio');

    const slug = slugIdx >= 0 ? String(row[slugIdx] ?? '').trim().toLowerCase() : 'audio-pa';
    const categoryId = slugToId.get(slug) || categories[0]?.id;
    if (!categoryId && (slugIdx < 0 || !slug))
      errors.push('Categoría no indicada. Use: consolas, microfonos, parlantes, etc.');
    else if (slug && !slugToId.get(slug))
      errors.push(`Categoría no encontrada: "${slug}". Use: consolas, microfonos, parlantes, etc.`);

    const rawStatus = statusIdx >= 0 && row[statusIdx] ? String(row[statusIdx]).trim() : '';
    const status = normalizeStatus(rawStatus || 'Operativo');
    const rawStatusNorm = rawStatus.toUpperCase().replace(/\s+/g, '_');
    if (rawStatus && rawStatusNorm !== status) {
      corrections.push({ field: 'Estado', from: rawStatus, to: status });
    }

    const rawLocation = locIdx >= 0 && row[locIdx] ? String(row[locIdx]).trim() : '';
    const location = normalizeLocation(rawLocation || 'Cuarto de almacenamiento');
    const rawLocNorm = rawLocation.toUpperCase().replace(/\s+/g, '_').replace(/Ó/g, 'O').replace(/Í/g, 'I').replace(/É/g, 'E');
    if (rawLocation && rawLocNorm !== location) {
      corrections.push({ field: 'Ubicación', from: rawLocation, to: location });
    }

    if (priceIdx >= 0 && row[priceIdx]) {
      const v = String(row[priceIdx]).replace(',', '.').trim();
      if (v && isNaN(parseFloat(v))) errors.push('Precio debe ser un número');
    }
    if (condIdx >= 0 && row[condIdx]) {
      const n = parseInt(String(row[condIdx]), 10);
      if (isNaN(n) || n < 0 || n > 100) errors.push('Condición debe ser un número entre 0 y 100');
    }

    const valid = errors.length === 0;
    if (valid) result.validCount++;
    else result.invalidCount++;
    result.rows.push({ row: i + 1, valid, errors, corrections });
  }
  return result;
}

// Validar archivo de equipos (sin importar)
router.post('/devices/validate', requireRole('ADMIN', 'MANAGER'), upload.single('file'), async (req: AuthRequest, res, next) => {
  try {
    const file = req.file;
    if (!file) throw new AppError(400, 'No se envió archivo Excel');
    const wb = XLSX.read(file.buffer, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1 }) as string[][];
    if (rows.length < 2) {
      return res.json({
        headerErrors: 'El archivo debe tener al menos una fila de datos',
        totalRows: 0,
        validCount: 0,
        invalidCount: 0,
        rows: [],
      } as ValidateDevicesResult);
    }
    const headers = rows[0].map((h) => String(h || '').trim());
    const nameIdx = headers.findIndex((h) => /nombre/i.test(h));
    const brandIdx = headers.findIndex((h) => /marca/i.test(h));
    const modelIdx = headers.findIndex((h) => /modelo/i.test(h));
    if (nameIdx < 0 || brandIdx < 0 || modelIdx < 0) {
      return res.json({
        headerErrors: 'El archivo debe tener columnas: Nombre, Marca, Modelo',
        totalRows: 0,
        validCount: 0,
        invalidCount: 0,
        rows: [],
      } as ValidateDevicesResult);
    }
    const categories = await prisma.category.findMany({ select: { id: true, slug: true, name: true } });
    const slugToId = new Map<string, string>();
    categories.forEach((c) => {
      slugToId.set(c.slug.toLowerCase(), c.id);
      slugToId.set(c.name.toLowerCase(), c.id);
    });
    const result = validateDeviceRows(rows, headers, slugToId, categories);
    res.json(result);
  } catch (e) {
    next(e);
  }
});

// Importar equipos desde Excel
router.post('/devices', requireRole('ADMIN', 'MANAGER'), upload.single('file'), async (req: AuthRequest, res, next) => {
  try {
    const file = req.file;
    if (!file) throw new AppError(400, 'No se envi? archivo Excel');
    const wb = XLSX.read(file.buffer, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1 }) as string[][];
    if (rows.length < 2) throw new AppError(400, 'El archivo debe tener al menos una fila de datos');
    const headers = rows[0].map((h) => String(h || '').trim());
    const nameIdx = headers.findIndex((h) => /nombre/i.test(h));
    const brandIdx = headers.findIndex((h) => /marca/i.test(h));
    const modelIdx = headers.findIndex((h) => /modelo/i.test(h));
    if (nameIdx < 0 || brandIdx < 0 || modelIdx < 0) {
      throw new AppError(400, 'El archivo debe tener columnas: Nombre, Marca, Modelo');
    }
    const slugIdx = headers.findIndex((h) => /categoria|slug/i.test(h));
    const statusIdx = headers.findIndex((h) => /estado/i.test(h));
    const locIdx = headers.findIndex((h) => /ubicacion|ubicaci?n/i.test(h));
    const serialIdx = headers.findIndex((h) => /serie/i.test(h));
    const priceIdx = headers.findIndex((h) => /precio/i.test(h));
    const supplierIdx = headers.findIndex((h) => /proveedor/i.test(h));
    const notesIdx = headers.findIndex((h) => /notas/i.test(h));
    const observationIdx = headers.findIndex((h) => /observacion|observaci?n/i.test(h));
    const condIdx = headers.findIndex((h) => /condicion|condici?n/i.test(h));

    const categories = await prisma.category.findMany({ select: { id: true, slug: true, name: true } });
    const slugToId = new Map<string, string>();
    categories.forEach((c) => {
      slugToId.set(c.slug.toLowerCase(), c.id);
      slugToId.set(c.name.toLowerCase(), c.id);
    });

    const results: { success: number; errors: { row: number; message: string }[] } = { success: 0, errors: [] };
    const userId = req.user!.userId;

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i] || [];
      const name = String(row[nameIdx] ?? '').trim();
      const brand = String(row[brandIdx] ?? '').trim();
      const model = String(row[modelIdx] ?? '').trim();
      if (!name || !brand || !model) {
        results.errors.push({ row: i + 1, message: 'Nombre, Marca y Modelo son obligatorios' });
        continue;
      }
      const slug = slugIdx >= 0 ? String(row[slugIdx] ?? '').trim().toLowerCase() : 'audio-pa';
      const categoryId = slugToId.get(slug) || categories[0]?.id;
      if (!categoryId) {
        results.errors.push({ row: i + 1, message: 'Categor?a no encontrada. Use: consolas, microfonos, parlantes, etc.' });
        continue;
      }
      const prefix = slug.split('-')[0].toUpperCase().slice(0, 3) || 'EQP';
      const internalCode = await getNextInternalCode(prefix);
      const rawStatus = statusIdx >= 0 && row[statusIdx] ? String(row[statusIdx]).trim() : 'Operativo';
      const status = normalizeStatus(rawStatus);
      const rawLocation = locIdx >= 0 && row[locIdx] ? String(row[locIdx]).trim() : 'Cuarto de almacenamiento';
      const location = normalizeLocation(rawLocation);
      const serialNumber = serialIdx >= 0 && row[serialIdx] ? String(row[serialIdx]).trim() : null;
      const purchasePrice = priceIdx >= 0 && row[priceIdx] ? parseFloat(String(row[priceIdx]).replace(',', '.')) : null;
      const supplier = supplierIdx >= 0 && row[supplierIdx] ? String(row[supplierIdx]).trim() : null;
      const notes = notesIdx >= 0 && row[notesIdx] ? String(row[notesIdx]).trim() : null;
      const observation = observationIdx >= 0 && row[observationIdx] ? String(row[observationIdx]).trim().slice(0, 500) : null;
      const condition = condIdx >= 0 && row[condIdx] ? Math.min(100, Math.max(0, parseInt(String(row[condIdx]), 10) || 100)) : 100;

      try {
        await prisma.device.create({
          data: {
            name,
            brand,
            model,
            serialNumber,
            internalCode,
            categoryId,
            status,
            location,
            purchasePrice,
            supplier,
            notes,
            observation: observation || undefined,
            condition,
            createdBy: userId,
          },
        });
        results.success++;
      } catch (err) {
        results.errors.push({ row: i + 1, message: (err as Error).message });
      }
    }

    res.json(results);
  } catch (e) {
    next(e);
  }
});

// Tipos y mapeos para movimientos
type MovementType = 'CHECK_IN' | 'CHECK_OUT' | 'TRANSFER' | 'STATUS_CHANGE';
const MOVEMENT_TYPE_MAP: Record<string, MovementType> = {
  CHECK_IN: 'CHECK_IN',
  CHECK_OUT: 'CHECK_OUT',
  TRANSFER: 'TRANSFER',
  TRASLADO: 'TRANSFER',
  STATUS_CHANGE: 'STATUS_CHANGE',
  ENTRADA: 'CHECK_IN',
  SALIDA: 'CHECK_OUT',
  'CAMBIO ESTADO': 'STATUS_CHANGE',
  'CAMBIO_ESTADO': 'STATUS_CHANGE',
};
function normalizeMovementType(raw: string): MovementType {
  const key = raw.trim().toUpperCase().replace(/\s+/g, '_');
  return MOVEMENT_TYPE_MAP[key] ?? (MOVEMENT_TYPE_MAP[raw.trim()] ?? 'TRANSFER');
}

export type ValidationRowMovement = ValidationRow;
export type ValidateMovementsResult = ValidateDevicesResult;

function validateMovementRows(
  rows: string[][],
  headers: string[],
  deviceByCode: Map<string, { id: string; location: string }>
): ValidateMovementsResult {
  const codeIdx = headers.findIndex((h) => /codigo|código/i.test(h));
  const typeIdx = headers.findIndex((h) => /tipo/i.test(h));
  const reasonIdx = headers.findIndex((h) => /razon|razón|motivo/i.test(h));
  const fromIdx = headers.findIndex((h) => /desde|origen/i.test(h));
  const toIdx = headers.findIndex((h) => /hasta|destino/i.test(h));
  const dateIdx = headers.findIndex((h) => /fecha/i.test(h));
  const result: ValidateMovementsResult = { totalRows: Math.max(0, rows.length - 1), validCount: 0, invalidCount: 0, rows: [] };

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i] || [];
    const errors: string[] = [];
    const corrections: { field: string; from: string; to: string }[] = [];
    const code = String(row[codeIdx] ?? '').trim();
    const reason = String(row[reasonIdx] ?? '').trim();
    if (!code) errors.push('Código de equipo es obligatorio');
    if (!reason) errors.push('Razón es obligatoria');
    const device = code ? deviceByCode.get(code) : null;
    if (code && !device) errors.push(`Equipo ${code} no encontrado`);
    const rawType = typeIdx >= 0 && row[typeIdx] ? String(row[typeIdx]).trim() : '';
    const type = normalizeMovementType(rawType || 'TRANSFER');
    if (rawType && rawType.toUpperCase().replace(/\s/g, '_') !== type) {
      corrections.push({ field: 'Tipo', from: rawType, to: type });
    }
    const deviceLoc = device?.location ?? 'STORAGE_ROOM';
    const rawFrom = fromIdx >= 0 && row[fromIdx] ? String(row[fromIdx]).trim() : '';
    const fromLoc = rawFrom ? normalizeLocation(rawFrom) : (deviceLoc as DeviceLocation);
    const rawFromNorm = rawFrom.toUpperCase().replace(/\s+/g, '_').replace(/Ó/g, 'O').replace(/Í/g, 'I').replace(/É/g, 'E');
    if (rawFrom && rawFromNorm !== fromLoc) {
      corrections.push({ field: 'Desde', from: rawFrom, to: fromLoc });
    }
    const rawTo = toIdx >= 0 && row[toIdx] ? String(row[toIdx]).trim() : '';
    const toLoc = rawTo ? normalizeLocation(rawTo) : (deviceLoc as DeviceLocation);
    const rawToNorm = rawTo.toUpperCase().replace(/\s+/g, '_').replace(/Ó/g, 'O').replace(/Í/g, 'I').replace(/É/g, 'E');
    if (rawTo && rawToNorm !== toLoc) {
      corrections.push({ field: 'Hasta', from: rawTo, to: toLoc });
    }
    if (dateIdx >= 0 && row[dateIdx]) {
      const d = new Date(String(row[dateIdx]));
      if (Number.isNaN(d.getTime())) errors.push('Fecha inválida');
    }
    const valid = errors.length === 0;
    if (valid) result.validCount++;
    else result.invalidCount++;
    result.rows.push({ row: i + 1, valid, errors, corrections });
  }
  return result;
}

router.post('/movements/validate', requireRole('ADMIN', 'MANAGER', 'TECHNICIAN'), upload.single('file'), async (req: AuthRequest, res, next) => {
  try {
    const file = req.file;
    if (!file) throw new AppError(400, 'No se envió archivo Excel');
    const wb = XLSX.read(file.buffer, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1 }) as string[][];
    if (rows.length < 2) {
      return res.json({ headerErrors: 'El archivo debe tener al menos una fila de datos', totalRows: 0, validCount: 0, invalidCount: 0, rows: [] } as ValidateMovementsResult);
    }
    const headers = rows[0].map((h) => String(h || '').trim());
    const codeIdx = headers.findIndex((h) => /codigo|código/i.test(h));
    const reasonIdx = headers.findIndex((h) => /razon|razón|motivo/i.test(h));
    if (codeIdx < 0 || reasonIdx < 0) {
      return res.json({ headerErrors: 'El archivo debe tener columnas: Codigo_Equipo y Razon', totalRows: 0, validCount: 0, invalidCount: 0, rows: [] } as ValidateMovementsResult);
    }
    const codes = new Set<string>();
    for (let i = 1; i < rows.length; i++) {
      const c = String(rows[i]?.[codeIdx] ?? '').trim();
      if (c) codes.add(c);
    }
    const devices = await prisma.device.findMany({
      where: { internalCode: { in: Array.from(codes) }, deletedAt: null },
      select: { id: true, internalCode: true, location: true },
    });
    const deviceByCode = new Map(devices.map((d) => [d.internalCode, { id: d.id, location: d.location }]));
    const result = validateMovementRows(rows, headers, deviceByCode);
    res.json(result);
  } catch (e) {
    next(e);
  }
});

// Importar traslados desde Excel
router.post('/movements', requireRole('ADMIN', 'MANAGER', 'TECHNICIAN'), upload.single('file'), async (req: AuthRequest, res, next) => {
  try {
    const file = req.file;
    if (!file) throw new AppError(400, 'No se envió archivo Excel');
    const wb = XLSX.read(file.buffer, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1 }) as string[][];
    if (rows.length < 2) throw new AppError(400, 'El archivo debe tener al menos una fila de datos');
    const headers = rows[0].map((h) => String(h || '').trim());
    const codeIdx = headers.findIndex((h) => /codigo|c?digo/i.test(h));
    const typeIdx = headers.findIndex((h) => /tipo/i.test(h));
    const reasonIdx = headers.findIndex((h) => /razon|raz?n|motivo/i.test(h));
    const fromIdx = headers.findIndex((h) => /desde|origen/i.test(h));
    const toIdx = headers.findIndex((h) => /hasta|destino/i.test(h));
    const respIdx = headers.findIndex((h) => /responsable/i.test(h));
    const dateIdx = headers.findIndex((h) => /fecha/i.test(h));
    if (codeIdx < 0 || reasonIdx < 0) {
      throw new AppError(400, 'El archivo debe tener columnas: Codigo_Equipo y Razon');
    }

    const results: { success: number; errors: { row: number; message: string }[] } = { success: 0, errors: [] };
    const defaultUserId = req.user!.userId;

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i] || [];
      const code = String(row[codeIdx] ?? '').trim();
      const reason = String(row[reasonIdx] ?? '').trim();
      if (!code || !reason) {
        results.errors.push({ row: i + 1, message: 'Código y razón son obligatorios' });
        continue;
      }
      const device = await prisma.device.findFirst({ where: { internalCode: code, deletedAt: null } });
      if (!device) {
        results.errors.push({ row: i + 1, message: `Equipo ${code} no encontrado` });
        continue;
      }
      const rawType = typeIdx >= 0 && row[typeIdx] ? String(row[typeIdx]).trim() : '';
      const type = normalizeMovementType(rawType || 'TRANSFER');
      const fromLocRaw = fromIdx >= 0 && row[fromIdx] ? String(row[fromIdx]).trim() : '';
      const toLocRaw = toIdx >= 0 && row[toIdx] ? String(row[toIdx]).trim() : '';
      const fromLoc = fromLocRaw ? normalizeLocation(fromLocRaw) : (device.location as DeviceLocation);
      const toLoc = toLocRaw ? normalizeLocation(toLocRaw) : (device.location as DeviceLocation);

      let moveUserId = defaultUserId;
      if (respIdx >= 0 && row[respIdx]) {
        const respEmail = String(row[respIdx]).trim();
        const respUser = await prisma.user.findFirst({ where: { email: { equals: respEmail, mode: 'insensitive' } } });
        if (respUser) moveUserId = respUser.id;
      }

      const moveDate = dateIdx >= 0 && row[dateIdx]
        ? new Date(String(row[dateIdx]))
        : new Date();
      if (isNaN(moveDate.getTime())) {
        results.errors.push({ row: i + 1, message: 'Fecha inválida' });
        continue;
      }

      try {
        await prisma.$transaction([
          prisma.movement.create({
            data: {
              deviceId: device.id,
              type,
              fromLocation: fromLoc,
              toLocation: toLoc,
              reason,
              userId: moveUserId,
              createdAt: moveDate,
            },
          }),
          prisma.device.update({
            where: { id: device.id },
            data: { location: toLoc },
          }),
        ]);
        results.success++;
      } catch (err) {
        results.errors.push({ row: i + 1, message: (err as Error).message });
      }
    }

    res.json(results);
  } catch (e) {
    next(e);
  }
});

// Validación mantenimiento (nuevos registros)
const MAINT_TYPE_MAP: Record<string, string> = {
  preventivo: 'preventivo',
  correctivo: 'correctivo',
  calibracion: 'calibracion',
  calibración: 'calibracion',
};
function normalizeMaintenanceType(raw: string): string {
  const key = raw.trim().toLowerCase().replace(/\s+/g, '_').normalize('NFD').replace(/\u0300/g, '');
  return MAINT_TYPE_MAP[key] ?? MAINT_TYPE_MAP[raw.trim().toLowerCase()] ?? 'preventivo';
}

export type ValidateMaintenanceResult = ValidateDevicesResult;

function validateMaintenanceRows(
  rows: string[][],
  headers: string[],
  deviceByCode: Map<string, { id: string }>
): ValidateMaintenanceResult {
  const codeIdx = headers.findIndex((h) => /codigo|código|equipo/i.test(h));
  const descIdx = headers.findIndex((h) => /descripcion|descripción|motivo/i.test(h));
  const typeIdx = headers.findIndex((h) => /tipo/i.test(h));
  const dateIdx = headers.findIndex((h) => /fecha|inicio/i.test(h));
  const result: ValidateMaintenanceResult = { totalRows: Math.max(0, rows.length - 1), validCount: 0, invalidCount: 0, rows: [] };

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i] || [];
    const errors: string[] = [];
    const corrections: { field: string; from: string; to: string }[] = [];
    const code = String(row[codeIdx] ?? '').trim();
    const description = String(row[descIdx] ?? '').trim();
    if (!code) errors.push('Código de equipo es obligatorio');
    if (!description) errors.push('Descripción es obligatoria');
    const device = code ? deviceByCode.get(code) : null;
    if (code && !device) errors.push(`Equipo ${code} no encontrado`);
    const rawType = typeIdx >= 0 && row[typeIdx] ? String(row[typeIdx]).trim() : '';
    const type = normalizeMaintenanceType(rawType || 'preventivo');
    if (rawType && normalizeMaintenanceType(rawType) !== rawType.toLowerCase()) {
      corrections.push({ field: 'Tipo', from: rawType, to: type });
    }
    if (dateIdx >= 0 && row[dateIdx]) {
      const d = new Date(String(row[dateIdx]));
      if (Number.isNaN(d.getTime())) errors.push('Fecha inicio inválida');
    }
    const valid = errors.length === 0;
    if (valid) result.validCount++;
    else result.invalidCount++;
    result.rows.push({ row: i + 1, valid, errors, corrections });
  }
  return result;
}

router.post('/maintenance/validate', requireRole('ADMIN', 'MANAGER', 'TECHNICIAN'), upload.single('file'), async (req: AuthRequest, res, next) => {
  try {
    const file = req.file;
    if (!file) throw new AppError(400, 'No se envió archivo Excel');
    const wb = XLSX.read(file.buffer, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1 }) as string[][];
    if (rows.length < 2) {
      return res.json({ headerErrors: 'El archivo debe tener al menos una fila de datos', totalRows: 0, validCount: 0, invalidCount: 0, rows: [] } as ValidateMaintenanceResult);
    }
    const headers = rows[0].map((h) => String(h || '').trim());
    const codeIdx = headers.findIndex((h) => /codigo|código|equipo/i.test(h));
    const descIdx = headers.findIndex((h) => /descripcion|descripción|motivo/i.test(h));
    if (codeIdx < 0 || descIdx < 0) {
      return res.json({ headerErrors: 'El archivo debe tener columnas: Codigo_Equipo y Descripcion', totalRows: 0, validCount: 0, invalidCount: 0, rows: [] } as ValidateMaintenanceResult);
    }
    const codes = new Set<string>();
    for (let i = 1; i < rows.length; i++) {
      const c = String(rows[i]?.[codeIdx] ?? '').trim();
      if (c) codes.add(c);
    }
    const devices = await prisma.device.findMany({
      where: { internalCode: { in: Array.from(codes) }, deletedAt: null },
      select: { id: true, internalCode: true },
    });
    const deviceByCode = new Map(devices.map((d) => [d.internalCode, { id: d.id }]));
    const result = validateMaintenanceRows(rows, headers, deviceByCode);
    res.json(result);
  } catch (e) {
    next(e);
  }
});

// Importar equipos a mantenimiento: Excel con Codigo_Equipo, Descripcion, Tipo, Fecha_inicio
router.post('/maintenance', requireRole('ADMIN', 'MANAGER', 'TECHNICIAN'), upload.single('file'), async (req: AuthRequest, res, next) => {
  try {
    const file = req.file;
    if (!file) throw new AppError(400, 'No se envió archivo Excel');
    const wb = XLSX.read(file.buffer, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1 }) as string[][];
    if (rows.length < 2) throw new AppError(400, 'El archivo debe tener al menos una fila de datos');
    const headers = rows[0].map((h) => String(h || '').trim());
    const codeIdx = headers.findIndex((h) => /codigo|c?digo|equipo/i.test(h));
    const descIdx = headers.findIndex((h) => /descripcion|descripci?n|motivo/i.test(h));
    const typeIdx = headers.findIndex((h) => /tipo/i.test(h));
    const dateIdx = headers.findIndex((h) => /fecha|inicio/i.test(h));
    if (codeIdx < 0 || descIdx < 0) {
      throw new AppError(400, 'El archivo debe tener columnas: Codigo_Equipo y Descripcion');
    }
    const results: { success: number; errors: { row: number; message: string }[] } = { success: 0, errors: [] };
    const userId = req.user!.userId;

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i] || [];
      const code = String(row[codeIdx] ?? '').trim();
      const description = String(row[descIdx] ?? '').trim();
      if (!code || !description) {
        results.errors.push({ row: i + 1, message: 'Codigo_Equipo y Descripcion son obligatorios' });
        continue;
      }
      const device = await prisma.device.findFirst({ where: { internalCode: code, deletedAt: null } });
      if (!device) {
        results.errors.push({ row: i + 1, message: `Equipo ${code} no encontrado` });
        continue;
      }
      const typeRaw = typeIdx >= 0 && row[typeIdx] ? String(row[typeIdx]).trim() : '';
      const type = normalizeMaintenanceType(typeRaw || 'preventivo');
      let startDate = new Date();
      if (dateIdx >= 0 && row[dateIdx]) {
        const parsed = new Date(String(row[dateIdx]));
        if (!Number.isNaN(parsed.getTime())) startDate = parsed;
      }
      try {
        await prisma.$transaction([
          prisma.device.update({
            where: { id: device.id },
            data: { status: 'MAINTENANCE' },
          }),
          prisma.maintenance.create({
            data: {
              deviceId: device.id,
              type,
              description,
              startDate,
              status: 'SCHEDULED',
              userId,
            },
          }),
        ]);
        results.success++;
      } catch (err) {
        results.errors.push({ row: i + 1, message: (err as Error).message });
      }
    }

    res.json(results);
  } catch (e) {
    next(e);
  }
});

// Validación actualización masiva de mantenimiento
const MAINT_STATUS_MAP: Record<string, string> = {
  SCHEDULED: 'SCHEDULED',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  PROGRAMADO: 'SCHEDULED',
  'EN PROGRESO': 'IN_PROGRESS',
  EN_PROGRESO: 'IN_PROGRESS',
  COMPLETADO: 'COMPLETED',
};
function normalizeMaintenanceStatus(raw: string): string {
  const key = raw.trim().toUpperCase().replace(/\s+/g, '_');
  return MAINT_STATUS_MAP[key] ?? MAINT_STATUS_MAP[raw.trim()] ?? '';
}

export type ValidateMaintenanceUpdateResult = ValidateDevicesResult;

function validateMaintenanceUpdateRows(
  rows: string[][],
  headers: string[],
  maintenanceIds: Set<string>
): ValidateMaintenanceUpdateResult {
  const maintIdCol = headers.findIndex((h) => /id_mantenimiento|id/i.test(String(h)) && /mantenimiento/i.test(String(h)));
  const altCol = headers.findIndex((h) => String(h).trim() === 'Id_Mantenimiento');
  const maintIdIdx = maintIdCol >= 0 ? maintIdCol : altCol;
  const statusIdx = headers.findIndex((h) => /estado/i.test(h));
  const typeIdx = headers.findIndex((h) => /tipo/i.test(h));
  const result: ValidateMaintenanceUpdateResult = { totalRows: Math.max(0, rows.length - 1), validCount: 0, invalidCount: 0, rows: [] };

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i] || [];
    const errors: string[] = [];
    const corrections: { field: string; from: string; to: string }[] = [];
    const id = String(row[maintIdIdx] ?? '').trim();
    if (!id) {
      errors.push('Id_Mantenimiento es obligatorio');
      result.invalidCount++;
      result.rows.push({ row: i + 1, valid: false, errors, corrections });
      continue;
    }
    if (!maintenanceIds.has(id)) errors.push(`Registro de mantenimiento ${id} no encontrado`);
    if (statusIdx >= 0 && row[statusIdx]) {
      const rawSt = String(row[statusIdx]).trim();
      const st = normalizeMaintenanceStatus(rawSt);
      if (st && rawSt.toUpperCase().replace(/\s/g, '_') !== st) {
        corrections.push({ field: 'Estado', from: rawSt, to: st });
      }
    }
    if (typeIdx >= 0 && row[typeIdx]) {
      const rawType = String(row[typeIdx]).trim();
      const type = normalizeMaintenanceType(rawType);
      if (rawType && normalizeMaintenanceType(rawType) !== rawType.toLowerCase()) {
        corrections.push({ field: 'Tipo', from: rawType, to: type });
      }
    }
    const valid = errors.length === 0;
    if (valid) result.validCount++;
    else result.invalidCount++;
    result.rows.push({ row: i + 1, valid, errors, corrections });
  }
  return result;
}

router.post('/maintenance-update/validate', requireRole('ADMIN', 'MANAGER', 'TECHNICIAN'), upload.single('file'), async (req: AuthRequest, res, next) => {
  try {
    const file = req.file;
    if (!file) throw new AppError(400, 'No se envió archivo Excel');
    const wb = XLSX.read(file.buffer, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1 }) as string[][];
    if (rows.length < 2) {
      return res.json({ headerErrors: 'El archivo debe tener al menos una fila de datos', totalRows: 0, validCount: 0, invalidCount: 0, rows: [] } as ValidateMaintenanceUpdateResult);
    }
    const headers = rows[0].map((h) => String(h || '').trim());
    const maintIdCol = headers.findIndex((h) => /id_mantenimiento|id/i.test(String(h)) && /mantenimiento/i.test(String(h)));
    const altCol = headers.findIndex((h) => String(h).trim() === 'Id_Mantenimiento');
    const maintIdIdx = maintIdCol >= 0 ? maintIdCol : altCol;
    if (maintIdIdx < 0) {
      return res.json({ headerErrors: 'El archivo debe tener la columna Id_Mantenimiento', totalRows: 0, validCount: 0, invalidCount: 0, rows: [] } as ValidateMaintenanceUpdateResult);
    }
    const ids = new Set<string>();
    for (let i = 1; i < rows.length; i++) {
      const id = String(rows[i]?.[maintIdIdx] ?? '').trim();
      if (id) ids.add(id);
    }
    const found = await prisma.maintenance.findMany({ where: { id: { in: Array.from(ids) } }, select: { id: true } });
    const maintenanceIds = new Set(found.map((m) => m.id));
    const result = validateMaintenanceUpdateRows(rows, headers, maintenanceIds);
    res.json(result);
  } catch (e) {
    next(e);
  }
});

// Cargar datos de mantenimiento de forma masiva (actualizar registros existentes)
// Excel con Id_Mantenimiento y columnas: Tipo, Descripcion, Fecha_inicio, Estado, Costo, Tecnico, Fecha_fin, Notas
router.post('/maintenance-update', requireRole('ADMIN', 'MANAGER', 'TECHNICIAN'), upload.single('file'), async (req: AuthRequest, res, next) => {
  try {
    const file = req.file;
    if (!file) throw new AppError(400, 'No se envió archivo Excel');
    const wb = XLSX.read(file.buffer, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1 }) as string[][];
    if (rows.length < 2) throw new AppError(400, 'El archivo debe tener al menos una fila de datos');
    const headers = rows[0].map((h) => String(h || '').trim());
    const maintIdCol = headers.findIndex((h) => /id_mantenimiento|id/i.test(String(h)) && /mantenimiento/i.test(String(h)));
    const altCol = headers.findIndex((h) => String(h).trim() === 'Id_Mantenimiento');
    const maintIdIdx = maintIdCol >= 0 ? maintIdCol : altCol;
    if (maintIdIdx < 0) throw new AppError(400, 'El archivo debe tener la columna Id_Mantenimiento');
    const typeIdx = headers.findIndex((h) => /tipo/i.test(h));
    const descIdx = headers.findIndex((h) => /descripcion|descripci?n/i.test(h));
    const startIdx = headers.findIndex((h) => /fecha_inicio|inicio/i.test(h));
    const statusIdx = headers.findIndex((h) => /estado/i.test(h));
    const costIdx = headers.findIndex((h) => /costo/i.test(h));
    const techIdx = headers.findIndex((h) => /tecnico|t?cnico/i.test(h));
    const endIdx = headers.findIndex((h) => /fecha_fin|fin/i.test(h));
    const notesIdx = headers.findIndex((h) => /notas/i.test(h));
    const results: { success: number; errors: { row: number; message: string }[] } = { success: 0, errors: [] };

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i] || [];
      const id = String(row[maintIdIdx] ?? '').trim();
      if (!id) {
        results.errors.push({ row: i + 1, message: 'Id_Mantenimiento es obligatorio' });
        continue;
      }
      const maintenance = await prisma.maintenance.findUnique({
        where: { id },
        include: { device: true },
      });
      if (!maintenance) {
        results.errors.push({ row: i + 1, message: `Registro de mantenimiento ${id} no encontrado` });
        continue;
      }
      const update: Record<string, unknown> = {};
      if (typeIdx >= 0 && row[typeIdx] != null && String(row[typeIdx]).trim()) {
        update.type = normalizeMaintenanceType(String(row[typeIdx]).trim());
      }
      if (descIdx >= 0 && row[descIdx] != null && String(row[descIdx]).trim()) {
        update.description = String(row[descIdx]).trim();
      }
      if (startIdx >= 0 && row[startIdx]) {
        const d = new Date(String(row[startIdx]));
        if (!Number.isNaN(d.getTime())) update.startDate = d;
      }
      if (statusIdx >= 0 && row[statusIdx] != null && String(row[statusIdx]).trim()) {
        const st = normalizeMaintenanceStatus(String(row[statusIdx]).trim());
        if (st && ['SCHEDULED', 'IN_PROGRESS', 'COMPLETED'].includes(st)) update.status = st;
      }
      if (costIdx >= 0 && row[costIdx] != null && String(row[costIdx]).trim() !== '') {
        const n = parseFloat(String(row[costIdx]).replace(',', '.'));
        if (!Number.isNaN(n)) update.cost = n;
      }
      if (techIdx >= 0 && row[techIdx] != null) update.technician = String(row[techIdx]).trim() || null;
      if (endIdx >= 0 && row[endIdx]) {
        const d = new Date(String(row[endIdx]));
        if (!Number.isNaN(d.getTime())) update.endDate = d;
      }
      if (notesIdx >= 0 && row[notesIdx] != null) update.notes = String(row[notesIdx]).trim() || null;
      const newStatus = (update.status as string) || maintenance.status;
      if (newStatus === 'COMPLETED' && !update.endDate && !maintenance.endDate) {
        (update as { endDate: Date }).endDate = new Date();
      }
      if (Object.keys(update).length === 0) {
        results.errors.push({ row: i + 1, message: 'No hay datos que actualizar en esta fila' });
        continue;
      }
      try {
        await prisma.$transaction(async (tx) => {
          await tx.maintenance.update({
            where: { id: maintenance.id },
            data: update as Parameters<typeof tx.maintenance.update>[0]['data'],
          });
          if (newStatus === 'COMPLETED') {
            await tx.device.update({
              where: { id: maintenance.deviceId },
              data: { status: 'ACTIVE' },
            });
          }
        });
        results.success++;
      } catch (err) {
        results.errors.push({ row: i + 1, message: (err as Error).message });
      }
    }

    res.json(results);
  } catch (e) {
    next(e);
  }
});

export default router;
