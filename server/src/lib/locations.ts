/**
 * Lugares dinámicos: Device.location y Movement.from/to usan Location.code.
 */
import type { PrismaClient } from '@prisma/client';
import { AppError } from '../middleware/errorHandler.js';

export async function assertLocationCode(prisma: PrismaClient, code: string): Promise<string> {
  const trimmed = String(code ?? '').trim();
  if (!trimmed) throw new AppError(400, 'La ubicación es obligatoria');
  if (isTemporaryLocation(trimmed)) return trimmed;
  const loc = await prisma.location.findUnique({ where: { code: trimmed } });
  if (!loc) throw new AppError(400, `Ubicación no válida: "${trimmed}". Créala en Lugares.`);
  return loc.code;
}

/** Prefijo para lugares temporales de eventos (no están en la tabla Location). */
export const TEMP_LOCATION_PREFIX = '@';

export function isTemporaryLocation(code: string): boolean {
  return String(code).startsWith(TEMP_LOCATION_PREFIX);
}

/** Convierte un nombre libre (ej. "Teatro Municipal") en código almacenable. */
export function temporaryLocationCode(label: string): string {
  const name = label.trim();
  if (!name) throw new AppError(400, 'Indica el nombre del lugar del evento');
  const code = TEMP_LOCATION_PREFIX + name;
  if (code.length > 64) throw new AppError(400, 'Nombre del lugar demasiado largo (máx. 63 caracteres)');
  return code;
}

export function locationDisplayName(code: string, nameMap?: Record<string, string>): string {
  if (!code) return '—';
  if (isTemporaryLocation(code)) return code.slice(TEMP_LOCATION_PREFIX.length);
  return nameMap?.[code] ?? code.replace(/_/g, ' ');
}

/** Destino del evento: lugar registrado o temporal (concierto, teatro, etc.). */
export async function resolveEventDestination(
  prisma: PrismaClient,
  opts: { toLocation?: string; toLocationCustom?: string }
): Promise<string> {
  const custom = opts.toLocationCustom?.trim();
  if (custom) return temporaryLocationCode(custom);
  return assertLocationCode(prisma, opts.toLocation ?? 'MAIN_AUDITORIUM');
}

export async function locationNameMap(prisma: PrismaClient): Promise<Record<string, string>> {
  const list = await prisma.location.findMany({ select: { code: true, name: true } });
  return Object.fromEntries(list.map((l) => [l.code, l.name]));
}

/** Código de almacén por defecto (STORAGE_ROOM o el primer lugar). */
export async function defaultStorageCode(prisma: PrismaClient): Promise<string> {
  const storage = await prisma.location.findUnique({ where: { code: 'STORAGE_ROOM' } });
  if (storage) return storage.code;
  const first = await prisma.location.findFirst({ orderBy: { sortOrder: 'asc' } });
  if (!first) throw new AppError(400, 'No hay lugares configurados. Crea al menos uno en Lugares.');
  return first.code;
}

/** Asegura que exista el lugar "En préstamo" y devuelve su código. */
export async function ensureOnLoanCode(prisma: PrismaClient): Promise<string> {
  const existing = await prisma.location.findUnique({ where: { code: 'ON_LOAN' } });
  if (existing) return existing.code;
  const created = await prisma.location.create({
    data: { code: 'ON_LOAN', name: 'En préstamo', sortOrder: 99 },
  });
  return created.code;
}
