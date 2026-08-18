/**
 * Lugares dinámicos: Device.location y Movement.from/to usan Location.code.
 */
import type { PrismaClient } from '@prisma/client';
import { AppError } from '../middleware/errorHandler.js';

export async function assertLocationCode(prisma: PrismaClient, code: string): Promise<string> {
  const trimmed = String(code ?? '').trim();
  if (!trimmed) throw new AppError(400, 'La ubicación es obligatoria');
  const loc = await prisma.location.findUnique({ where: { code: trimmed } });
  if (!loc) throw new AppError(400, `Ubicación no válida: "${trimmed}". Créala en Lugares.`);
  return loc.code;
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
