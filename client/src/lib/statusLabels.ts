/**
 * Etiquetas en español para estados y ubicaciones mostrados en la UI.
 * El backend sigue usando los valores en inglés (enum).
 */

export const DEVICE_STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Operativo',
  MAINTENANCE: 'En mantenimiento',
  LOANED: 'En préstamo',
  DAMAGED: 'Dañado',
  LOST: 'Extraviado',
  RETIRED: 'Dado de baja',
};

export const DEVICE_LOCATION_LABELS: Record<string, string> = {
  MAIN_AUDITORIUM: 'Auditorio principal',
  RECORDING_STUDIO: 'Estudio de grabación',
  STORAGE_ROOM: 'Cuarto de almacenamiento',
  YOUTH_ROOM: 'Salón de jóvenes',
  CHAPEL: 'Capilla',
  ON_LOAN: 'En préstamo',
};

export const LOAN_STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Activo',
  RETURNED: 'Devuelto',
  OVERDUE: 'Vencido',
};

export const MAINTENANCE_STATUS_LABELS: Record<string, string> = {
  SCHEDULED: 'Programado',
  IN_PROGRESS: 'En progreso',
  COMPLETED: 'Completado',
};

export function deviceStatusLabel(status: string): string {
  return DEVICE_STATUS_LABELS[status] ?? status;
}

export function deviceLocationLabel(location: string): string {
  return DEVICE_LOCATION_LABELS[location] ?? location?.replace(/_/g, ' ') ?? '';
}

export function loanStatusLabel(status: string): string {
  return LOAN_STATUS_LABELS[status] ?? status;
}

export function maintenanceStatusLabel(status: string): string {
  return MAINTENANCE_STATUS_LABELS[status] ?? status;
}
