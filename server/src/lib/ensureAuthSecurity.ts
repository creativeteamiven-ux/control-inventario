import type { PrismaClient } from '@prisma/client';

/** Tablas/columnas de PIN + WebAuthn (compat Render/TiDB). */
export async function ensureAuthSecurity(prisma: PrismaClient): Promise<void> {
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE \`User\` ADD COLUMN \`authPinHash\` VARCHAR(191) NULL`);
  } catch {
    /* ya existe */
  }

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS \`WebAuthnCredential\` (
      \`id\` VARCHAR(191) NOT NULL,
      \`userId\` VARCHAR(191) NOT NULL,
      \`publicKey\` TEXT NOT NULL,
      \`counter\` BIGINT NOT NULL DEFAULT 0,
      \`deviceType\` VARCHAR(64) NULL,
      \`backedUp\` BOOLEAN NOT NULL DEFAULT false,
      \`transports\` VARCHAR(255) NULL,
      \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      \`updatedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      INDEX \`WebAuthnCredential_userId_idx\`(\`userId\`),
      PRIMARY KEY (\`id\`)
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);

  try {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE \`WebAuthnCredential\`
      ADD CONSTRAINT \`WebAuthnCredential_userId_fkey\`
      FOREIGN KEY (\`userId\`) REFERENCES \`User\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE
    `);
  } catch {
    /* ya existe */
  }
}
