-- Eventos con checklist de salida/entrada por escaneo
-- Tabla InventoryEvent (evita palabra reservada EVENT en MySQL/TiDB)
CREATE TABLE `InventoryEvent` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `eventDate` DATETIME(3) NOT NULL,
    `fromLocation` VARCHAR(64) NOT NULL,
    `toLocation` VARCHAR(64) NOT NULL,
    `status` ENUM('DRAFT', 'ACTIVE', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    `currentPhase` ENUM('OUTBOUND', 'INBOUND') NOT NULL DEFAULT 'OUTBOUND',
    `notes` TEXT NULL,
    `createdBy` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `InventoryEvent_status_idx`(`status`),
    INDEX `InventoryEvent_eventDate_idx`(`eventDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `InventoryEventItem` (
    `id` VARCHAR(191) NOT NULL,
    `eventId` VARCHAR(191) NOT NULL,
    `deviceId` VARCHAR(191) NOT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `outboundScannedAt` DATETIME(3) NULL,
    `outboundUserId` VARCHAR(191) NULL,
    `outboundUserName` VARCHAR(191) NULL,
    `inboundScannedAt` DATETIME(3) NULL,
    `inboundUserId` VARCHAR(191) NULL,
    `inboundUserName` VARCHAR(191) NULL,
    `outboundMovementId` VARCHAR(191) NULL,
    `inboundMovementId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `InventoryEventItem_eventId_idx`(`eventId`),
    UNIQUE INDEX `InventoryEventItem_eventId_deviceId_key`(`eventId`, `deviceId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `InventoryEventScan` (
    `id` VARCHAR(191) NOT NULL,
    `eventId` VARCHAR(191) NOT NULL,
    `deviceId` VARCHAR(191) NOT NULL,
    `phase` ENUM('OUTBOUND', 'INBOUND') NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `userName` VARCHAR(191) NOT NULL,
    `success` BOOLEAN NOT NULL,
    `message` VARCHAR(500) NULL,
    `deviceLocation` VARCHAR(64) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `InventoryEventScan_eventId_phase_idx`(`eventId`, `phase`),
    INDEX `InventoryEventScan_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `InventoryEventItem` ADD CONSTRAINT `InventoryEventItem_eventId_fkey` FOREIGN KEY (`eventId`) REFERENCES `InventoryEvent`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `InventoryEventItem` ADD CONSTRAINT `InventoryEventItem_deviceId_fkey` FOREIGN KEY (`deviceId`) REFERENCES `Device`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `InventoryEventScan` ADD CONSTRAINT `InventoryEventScan_eventId_fkey` FOREIGN KEY (`eventId`) REFERENCES `InventoryEvent`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
