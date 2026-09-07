import { PrismaClient } from '@prisma/client';

/**
 * Red de seguridad para el esquema de eventos, pensada para bases que se
 * crearon antes de que hubiera migraciones versionadas.
 *
 * Consulta primero `information_schema` y ejecuta solo lo que falte. Antes se
 * lanzaba cada sentencia a ciegas confiando en el `catch`, lo que llenaba el
 * log de arranque de errores «Duplicate column name» y escondía los problemas
 * reales. Cuando el esquema está completo, que es el caso normal, esto no
 * ejecuta ningún DDL.
 */

const CREATE_TABLES: Record<string, string> = {
  InventoryEvent: `
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
  `,
  InventoryEventList: `
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
  `,
  InventoryEventItem: `
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
  `,
  InventoryEventScan: `
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
  `,
};

const COLUMNS: { table: string; column: string; definition: string }[] = [
  { table: 'InventoryEventItem', column: 'listId', definition: '`listId` VARCHAR(191) NULL' },
  { table: 'InventoryEventItem', column: 'originLocation', definition: '`originLocation` VARCHAR(64) NULL' },
  {
    table: 'Movement',
    column: 'status',
    definition: "`status` ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'APPROVED'",
  },
  { table: 'Movement', column: 'eventId', definition: '`eventId` VARCHAR(191) NULL' },
  { table: 'Movement', column: 'eventListId', definition: '`eventListId` VARCHAR(191) NULL' },
  { table: 'Movement', column: 'approvedBy', definition: '`approvedBy` VARCHAR(191) NULL' },
  { table: 'Movement', column: 'approvedAt', definition: '`approvedAt` DATETIME(3) NULL' },
  { table: 'Movement', column: 'rejectedAt', definition: '`rejectedAt` DATETIME(3) NULL' },
];

const INDEXES: { table: string; name: string; columns: string }[] = [
  { table: 'InventoryEventItem', name: 'InventoryEventItem_listId_idx', columns: '`listId`' },
  { table: 'Movement', name: 'Movement_status_idx', columns: '`status`' },
  { table: 'Movement', name: 'Movement_eventId_idx', columns: '`eventId`' },
];

const FOREIGN_KEYS: { table: string; name: string; definition: string }[] = [
  {
    table: 'InventoryEventList',
    name: 'InventoryEventList_eventId_fkey',
    definition:
      'FOREIGN KEY (`eventId`) REFERENCES `InventoryEvent`(`id`) ON DELETE CASCADE ON UPDATE CASCADE',
  },
  {
    table: 'InventoryEventItem',
    name: 'InventoryEventItem_eventId_fkey',
    definition:
      'FOREIGN KEY (`eventId`) REFERENCES `InventoryEvent`(`id`) ON DELETE CASCADE ON UPDATE CASCADE',
  },
  {
    table: 'InventoryEventItem',
    name: 'InventoryEventItem_listId_fkey',
    definition:
      'FOREIGN KEY (`listId`) REFERENCES `InventoryEventList`(`id`) ON DELETE CASCADE ON UPDATE CASCADE',
  },
  {
    table: 'InventoryEventItem',
    name: 'InventoryEventItem_deviceId_fkey',
    definition:
      'FOREIGN KEY (`deviceId`) REFERENCES `Device`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE',
  },
  {
    table: 'InventoryEventScan',
    name: 'InventoryEventScan_eventId_fkey',
    definition:
      'FOREIGN KEY (`eventId`) REFERENCES `InventoryEvent`(`id`) ON DELETE CASCADE ON UPDATE CASCADE',
  },
];

/** Tablas sobre las que hay que inspeccionar columnas, índices y claves foráneas. */
const INSPECTED = [...Object.keys(CREATE_TABLES), 'Movement'];

async function inspect(prisma: PrismaClient) {
  const list = INSPECTED.map((t) => `'${t}'`).join(', ');

  const [tables, columns, indexes, constraints] = await Promise.all([
    prisma.$queryRawUnsafe<{ TABLE_NAME: string }[]>(
      `SELECT TABLE_NAME FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN (${list})`
    ),
    prisma.$queryRawUnsafe<{ TABLE_NAME: string; COLUMN_NAME: string }[]>(
      `SELECT TABLE_NAME, COLUMN_NAME FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN (${list})`
    ),
    prisma.$queryRawUnsafe<{ TABLE_NAME: string; INDEX_NAME: string }[]>(
      `SELECT TABLE_NAME, INDEX_NAME FROM information_schema.STATISTICS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN (${list})`
    ),
    prisma.$queryRawUnsafe<{ CONSTRAINT_NAME: string }[]>(
      `SELECT CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS
       WHERE TABLE_SCHEMA = DATABASE() AND CONSTRAINT_TYPE = 'FOREIGN KEY'
         AND TABLE_NAME IN (${list})`
    ),
  ]);

  return {
    tables: new Set(tables.map((r) => r.TABLE_NAME)),
    columns: new Set(columns.map((r) => `${r.TABLE_NAME}.${r.COLUMN_NAME}`)),
    indexes: new Set(indexes.map((r) => `${r.TABLE_NAME}.${r.INDEX_NAME}`)),
    constraints: new Set(constraints.map((r) => r.CONSTRAINT_NAME)),
  };
}

/**
 * Rellena `listId` en los ítems que se crearon antes de que existieran las
 * listas, agrupándolos en una «Lista general» por evento.
 */
async function backfillItemLists(prisma: PrismaClient): Promise<number> {
  const orphans = await prisma.$queryRawUnsafe<{ eventId: string }[]>(
    'SELECT `eventId` FROM `InventoryEventItem` WHERE `listId` IS NULL GROUP BY `eventId`'
  );

  for (const { eventId } of orphans) {
    const listId = `migr_${eventId.slice(0, 18)}_${Date.now().toString(36)}`;
    await prisma.$executeRawUnsafe(
      'INSERT INTO `InventoryEventList` (`id`, `eventId`, `name`, `kind`, `sortOrder`) VALUES (?, ?, ?, ?, ?)',
      listId,
      eventId,
      'Lista general',
      'CUSTOM',
      0
    );
    await prisma.$executeRawUnsafe(
      'UPDATE `InventoryEventItem` SET `listId` = ? WHERE `eventId` = ? AND `listId` IS NULL',
      listId,
      eventId
    );
  }

  return orphans.length;
}

export async function ensureEventTables(prisma: PrismaClient): Promise<void> {
  let schema = await inspect(prisma);
  const applied: string[] = [];

  const missingTables = Object.keys(CREATE_TABLES).filter((t) => !schema.tables.has(t));
  for (const table of missingTables) {
    await prisma.$executeRawUnsafe(CREATE_TABLES[table]);
    applied.push(`tabla ${table}`);
  }
  // Las tablas recién creadas ya traen sus columnas e índices propios.
  if (missingTables.length) schema = await inspect(prisma);

  for (const { table, column, definition } of COLUMNS) {
    if (!schema.tables.has(table) || schema.columns.has(`${table}.${column}`)) continue;
    await prisma.$executeRawUnsafe(`ALTER TABLE \`${table}\` ADD COLUMN ${definition}`);
    applied.push(`columna ${table}.${column}`);
  }

  for (const { table, name, columns } of INDEXES) {
    if (!schema.tables.has(table) || schema.indexes.has(`${table}.${name}`)) continue;
    await prisma.$executeRawUnsafe(`ALTER TABLE \`${table}\` ADD INDEX \`${name}\`(${columns})`);
    applied.push(`indice ${name}`);
  }

  for (const { table, name, definition } of FOREIGN_KEYS) {
    if (!schema.tables.has(table) || schema.constraints.has(name)) continue;
    await prisma.$executeRawUnsafe(
      `ALTER TABLE \`${table}\` ADD CONSTRAINT \`${name}\` ${definition}`
    );
    applied.push(`clave foranea ${name}`);
  }

  // El backfill es un arreglo de datos, no de esquema: si falla, la aplicación
  // sigue siendo usable porque puede crear listas nuevas.
  if (schema.tables.has('InventoryEventItem')) {
    try {
      const backfilled = await backfillItemLists(prisma);
      if (backfilled) applied.push(`${backfilled} evento(s) con lista general`);
    } catch (e) {
      console.warn(
        '[DB] No se pudo asignar lista general a los items antiguos:',
        e instanceof Error ? e.message : e
      );
    }
  }

  if (applied.length) {
    console.log(`[DB] Esquema de eventos actualizado: ${applied.join(', ')}`);
  }
}
