import type { PrismaClient } from '@prisma/client';

/**
 * Corrige drift típico de migración 0_init vs schema actual (TiDB/MySQL):
 * - Device.location / Movement locations como VARCHAR (no ENUM)
 * - Device.categoryId nullable
 * Fallos silenciosos si ya está alineado o el motor no lo permite.
 */
export async function ensureSchemaCompat(prisma: PrismaClient): Promise<void> {
  const statements = [
    `ALTER TABLE \`Device\` MODIFY COLUMN \`location\` VARCHAR(64) NOT NULL DEFAULT 'STORAGE_ROOM'`,
    `ALTER TABLE \`Device\` MODIFY COLUMN \`categoryId\` VARCHAR(191) NULL`,
    `ALTER TABLE \`Movement\` MODIFY COLUMN \`fromLocation\` VARCHAR(64) NULL`,
    `ALTER TABLE \`Movement\` MODIFY COLUMN \`toLocation\` VARCHAR(64) NULL`,
  ];
  for (const sql of statements) {
    try {
      await prisma.$executeRawUnsafe(sql);
    } catch {
      /* ya compatible o sin privilegio ALTER */
    }
  }
}
