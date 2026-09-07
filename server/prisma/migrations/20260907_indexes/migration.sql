-- Índices para los campos que intervienen en los filtros y ordenamientos más frecuentes.
-- Las columnas que son clave foránea (deviceId, categoryId) no se incluyen:
-- MySQL ya crea un índice al declarar la FOREIGN KEY.

-- Device: todos los listados filtran por deletedAt y combinan status y location.
CREATE INDEX `Device_deletedAt_idx` ON `Device`(`deletedAt`);
CREATE INDEX `Device_status_idx` ON `Device`(`status`);
CREATE INDEX `Device_location_idx` ON `Device`(`location`);
CREATE INDEX `Device_deletedAt_status_idx` ON `Device`(`deletedAt`, `status`);

-- Movement: historial paginado por fecha y pendientes por estado.
CREATE INDEX `Movement_createdAt_idx` ON `Movement`(`createdAt`);
CREATE INDEX `Movement_status_createdAt_idx` ON `Movement`(`status`, `createdAt`);

-- Maintenance y LoanRecord: listados por estado y fechas de vencimiento.
CREATE INDEX `Maintenance_status_idx` ON `Maintenance`(`status`);
CREATE INDEX `Maintenance_startDate_idx` ON `Maintenance`(`startDate`);
CREATE INDEX `LoanRecord_status_idx` ON `LoanRecord`(`status`);
CREATE INDEX `LoanRecord_expectedReturn_idx` ON `LoanRecord`(`expectedReturn`);

-- AuditLog: se consulta por entidad y siempre ordenado por fecha descendente.
-- userId no tiene relación declarada, así que aquí sí hace falta el índice.
CREATE INDEX `AuditLog_createdAt_idx` ON `AuditLog`(`createdAt`);
CREATE INDEX `AuditLog_entity_createdAt_idx` ON `AuditLog`(`entity`, `createdAt`);
CREATE INDEX `AuditLog_userId_idx` ON `AuditLog`(`userId`);
