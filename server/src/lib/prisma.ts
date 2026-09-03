import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { __soundvaultPrisma?: PrismaClient };

/** Cliente Prisma único (evita agotar el pool en Render/TiDB). */
export const prisma =
  globalForPrisma.__soundvaultPrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.__soundvaultPrisma = prisma;
}
