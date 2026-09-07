-- Índices para los campos que intervienen en los filtros y ordenamientos más frecuentes.

-- Device: todos los listados filtran por deletedAt y combinan status/location/categoryId.
CREATE INDEX `Device_deletedAt_idx` ON `Device`(`deletedAt`);
CREATE INDEX `Device_status_idx` ON `Device`(`status`);
CREATE INDEX `Device_location_idx` ON `Device`(`location`);
CREATE INDEX `Device_categoryId_idx` ON `Device`(`categoryId`);
CREATE INDEX `Device_deletedAt_status_idx` ON `Device`(`deletedAt`, `status`);

-- Hijos de Device: se consultan siempre por deviceId.
CREATE INDEX `DeviceImage_deviceId_idx` ON `DeviceImage`(`deviceId`);
CREATE INDEX `Document_deviceId_idx` ON `Document`(`deviceId`);

-- Movement: historial paginado por fecha y pendientes por estado.
CREATE INDEX `Movement_deviceId_idx` ON `Movement`(`deviceId`);
CREATE INDEX `Movement_createdAt_idx` ON `Movement`(`createdAt`);
CREATE INDEX `Movement_status_createdAt_idx` ON `Movement`(`status`, `createdAt`);

-- Maintenance y LoanRecord: listados por equipo, estado y fechas de vencimiento.
CREATE INDEX `Maintenance_deviceId_idx` ON `Maintenance`(`deviceId`);
CREATE INDEX `Maintenance_status_idx` ON `Maintenance`(`status`);
CREATE INDEX `Maintenance_startDate_idx` ON `Maintenance`(`startDate`);
CREATE INDEX `LoanRecord_deviceId_idx` ON `LoanRecord`(`deviceId`);
CREATE INDEX `LoanRecord_status_idx` ON `LoanRecord`(`status`);
CREATE INDEX `LoanRecord_expectedReturn_idx` ON `LoanRecord`(`expectedReturn`);

-- AuditLog: se consulta por entidad y siempre ordenado por fecha descendente.
CREATE INDEX `AuditLog_createdAt_idx` ON `AuditLog`(`createdAt`);
CREATE INDEX `AuditLog_entity_createdAt_idx` ON `AuditLog`(`entity`, `createdAt`);
CREATE INDEX `AuditLog_userId_idx` ON `AuditLog`(`userId`);
