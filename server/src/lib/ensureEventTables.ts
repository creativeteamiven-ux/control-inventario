import { PrismaClient } from '@prisma/client';

/** Crea/actualiza tablas de eventos (Render/TiDB puede no ejecutar prisma migrate). */
export async function ensureEventTables(prisma: PrismaClient): Promise<void> {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS \`InventoryEvent\` (
      \`id\` VARCHAR(191) NOT NULL,
      \`name\` VARCHAR(191) NOT NULL,
      \`eventDate\` DATETIME(3) NOT NULL,
      \`fromLocation\` VARCHAR(64) NOT NULL,
      \`toLocation\` VARCHAR(64) NOT NULL,
      \`status\` ENUM('DRAFT', 'ACTIVE', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
      \`currentPhase\` ENUM('OUTBOUND', 'INBOUND') NOT NULL DEFAULT 'OUTBOUND',
      \`notes\` TEXT NULL,
      \`createdBy\` VARCHAR(191) NOT NULL,
      \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      \`updatedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      INDEX \`InventoryEvent_status_idx\`(\`status\`),
      INDEX \`InventoryEvent_eventDate_idx\`(\`eventDate\`),
      PRIMARY KEY (\`id\`)
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS \`InventoryEventList\` (
      \`id\` VARCHAR(191) NOT NULL,
      \`eventId\` VARCHAR(191) NOT NULL,
      \`name\` VARCHAR(191) NOT NULL,
      \`kind\` ENUM('CUSTOM', 'CATEGORY') NOT NULL DEFAULT 'CUSTOM',
      \`categoryId\` VARCHAR(191) NULL,
      \`sortOrder\` INTEGER NOT NULL DEFAULT 0,
      \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      \`updatedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      INDEX \`InventoryEventList_eventId_idx\`(\`eventId\`),
      PRIMARY KEY (\`id\`)
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS \`InventoryEventItem\` (
      \`id\` VARCHAR(191) NOT NULL,
      \`eventId\` VARCHAR(191) NOT NULL,
      \`deviceId\` VARCHAR(191) NOT NULL,
      \`sortOrder\` INTEGER NOT NULL DEFAULT 0,
      \`outboundScannedAt\` DATETIME(3) NULL,
      \`outboundUserId\` VARCHAR(191) NULL,
      \`outboundUserName\` VARCHAR(191) NULL,
      \`inboundScannedAt\` DATETIME(3) NULL,
      \`inboundUserId\` VARCHAR(191) NULL,
      \`inboundUserName\` VARCHAR(191) NULL,
      \`outboundMovementId\` VARCHAR(191) NULL,
      \`inboundMovementId\` VARCHAR(191) NULL,
      \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      INDEX \`InventoryEventItem_eventId_idx\`(\`eventId\`),
      UNIQUE INDEX \`InventoryEventItem_eventId_deviceId_key\`(\`eventId\`, \`deviceId\`),
      PRIMARY KEY (\`id\`)
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS \`InventoryEventScan\` (
      \`id\` VARCHAR(191) NOT NULL,
      \`eventId\` VARCHAR(191) NOT NULL,
      \`deviceId\` VARCHAR(191) NOT NULL,
      \`phase\` ENUM('OUTBOUND', 'INBOUND') NOT NULL,
      \`userId\` VARCHAR(191) NOT NULL,
      \`userName\` VARCHAR(191) NOT NULL,
      \`success\` BOOLEAN NOT NULL,
      \`message\` VARCHAR(500) NULL,
      \`deviceLocation\` VARCHAR(64) NULL,
      \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      INDEX \`InventoryEventScan_eventId_phase_idx\`(\`eventId\`, \`phase\`),
      INDEX \`InventoryEventScan_createdAt_idx\`(\`createdAt\`),
      PRIMARY KEY (\`id\`)
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);

  // Columnas nuevas en items (idempotente)
  for (const sql of [
    `ALTER TABLE \`InventoryEventItem\` ADD COLUMN \`listId\` VARCHAR(191) NULL`,
    `ALTER TABLE \`InventoryEventItem\` ADD COLUMN \`originLocation\` VARCHAR(64) NULL`,
    `ALTER TABLE \`InventoryEventItem\` ADD INDEX \`InventoryEventItem_listId_idx\`(\`listId\`)`,
  ]) {
    try {
      await prisma.$executeRawUnsafe(sql);
    } catch {
      /* ya existe */
    }
  }

  // Movement: estado de autorización
  try {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE \`Movement\`
      ADD COLUMN \`status\` ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'APPROVED'
    `);
  } catch {
    /* ya existe */
  }
  for (const sql of [
    `ALTER TABLE \`Movement\` ADD COLUMN \`eventId\` VARCHAR(191) NULL`,
    `ALTER TABLE \`Movement\` ADD COLUMN \`eventListId\` VARCHAR(191) NULL`,
    `ALTER TABLE \`Movement\` ADD COLUMN \`approvedBy\` VARCHAR(191) NULL`,
    `ALTER TABLE \`Movement\` ADD COLUMN \`approvedAt\` DATETIME(3) NULL`,
    `ALTER TABLE \`Movement\` ADD COLUMN \`rejectedAt\` DATETIME(3) NULL`,
    `ALTER TABLE \`Movement\` ADD INDEX \`Movement_status_idx\`(\`status\`)`,
    `ALTER TABLE \`Movement\` ADD INDEX \`Movement_eventId_idx\`(\`eventId\`)`,
  ]) {
    try {
      await prisma.$executeRawUnsafe(sql);
    } catch {
      /* ya existe */
    }
  }

  // FKs
  for (const sql of [
    `ALTER TABLE \`InventoryEventList\` ADD CONSTRAINT \`InventoryEventList_eventId_fkey\`
      FOREIGN KEY (\`eventId\`) REFERENCES \`InventoryEvent\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`,
    `ALTER TABLE \`InventoryEventItem\` ADD CONSTRAINT \`InventoryEventItem_eventId_fkey\`
      FOREIGN KEY (\`eventId\`) REFERENCES \`InventoryEvent\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`,
    `ALTER TABLE \`InventoryEventItem\` ADD CONSTRAINT \`InventoryEventItem_listId_fkey\`
      FOREIGN KEY (\`listId\`) REFERENCES \`InventoryEventList\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`,
    `ALTER TABLE \`InventoryEventItem\` ADD CONSTRAINT \`InventoryEventItem_deviceId_fkey\`
      FOREIGN KEY (\`deviceId\`) REFERENCES \`Device\`(\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE`,
    `ALTER TABLE \`InventoryEventScan\` ADD CONSTRAINT \`InventoryEventScan_eventId_fkey\`
      FOREIGN KEY (\`eventId\`) REFERENCES \`InventoryEvent\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`,
  ]) {
    try {
      await prisma.$executeRawUnsafe(sql);
    } catch {
      /* ya existe */
    }
  }

  // Migrar ítems sin lista → "Lista general" por evento
  try {
    const orphans = (await prisma.$queryRawUnsafe(
      `SELECT \`eventId\`, COUNT(*) AS cnt FROM \`InventoryEventItem\` WHERE \`listId\` IS NULL GROUP BY \`eventId\``
    )) as { eventId: string; cnt: bigint }[];
    for (const row of orphans) {
      const eventId = row.eventId;
      const listId = `migr_${eventId.slice(0, 18)}_${Date.now().toString(36)}`;
      await prisma.$executeRawUnsafe(
        `INSERT INTO \`InventoryEventList\` (\`id\`, \`eventId\`, \`name\`, \`kind\`, \`sortOrder\`) VALUES (?, ?, 'Lista general', 'CUSTOM', 0)`,
        listId,
        eventId
      );
      await prisma.$executeRawUnsafe(
        `UPDATE \`InventoryEventItem\` SET \`listId\` = ? WHERE \`eventId\` = ? AND \`listId\` IS NULL`,
        listId,
        eventId
      );
    }
  } catch {
    /* si falla la migración, la app puede crear listas nuevas */
  }
}
