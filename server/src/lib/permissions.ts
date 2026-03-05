/**
 * Permisos detallados por módulo.
 * sensitive.view_cost: ver precios de compra y costos de mantenimiento (dato delicado).
 */

export interface PermissionDef {
  key: string;
  label: string;
  module: string;
  description: string;
}

export const PERMISSIONS: PermissionDef[] = [
  { key: 'inventory.view', label: 'Ver inventario', module: 'Inventario', description: 'Ver listado y detalle de equipos' },
  { key: 'inventory.create', label: 'Crear equipos', module: 'Inventario', description: 'Agregar nuevos equipos' },
  { key: 'inventory.edit', label: 'Editar equipos', module: 'Inventario', description: 'Modificar equipos existentes' },
  { key: 'inventory.delete', label: 'Eliminar equipos', module: 'Inventario', description: 'Dar de baja equipos' },
  { key: 'inventory.export', label: 'Importar/Exportar', module: 'Inventario', description: 'Plantillas e importación masiva' },
  { key: 'sensitive.view_cost', label: 'Ver precios y costos', module: 'Sensible', description: 'Ver precio de compra y costos de mantenimiento' },
  { key: 'categories.view', label: 'Ver categorías', module: 'Categorías', description: 'Ver listado de categorías' },
  { key: 'categories.edit', label: 'Editar categorías', module: 'Categorías', description: 'Crear, editar o eliminar categorías' },
  { key: 'maintenance.view', label: 'Ver mantenimiento', module: 'Mantenimiento', description: 'Ver registros de mantenimiento' },
  { key: 'maintenance.create', label: 'Gestionar mantenimiento', module: 'Mantenimiento', description: 'Crear, editar, plantillas y cargas masivas' },
  { key: 'maintenance.delete', label: 'Eliminar mantenimiento', module: 'Mantenimiento', description: 'Eliminar registros de mantenimiento' },
  { key: 'loans.view', label: 'Ver préstamos', module: 'Préstamos', description: 'Ver listado de préstamos' },
  { key: 'loans.create', label: 'Gestionar préstamos', module: 'Préstamos', description: 'Crear préstamos y registrar devoluciones' },
  { key: 'movements.view', label: 'Ver movimientos', module: 'Movimientos', description: 'Ver historial de movimientos' },
  { key: 'movements.create', label: 'Registrar movimientos', module: 'Movimientos', description: 'Cargar y registrar traslados' },
  { key: 'reports.view', label: 'Ver reportes', module: 'Reportes', description: 'Acceder al módulo de reportes' },
  { key: 'reports.export', label: 'Exportar reportes', module: 'Reportes', description: 'Descargar PDF/Excel de reportes' },
  { key: 'users.view', label: 'Ver usuarios', module: 'Usuarios', description: 'Ver listado de usuarios' },
  { key: 'users.create', label: 'Crear usuarios', module: 'Usuarios', description: 'Crear nuevos usuarios' },
  { key: 'users.edit', label: 'Editar usuarios', module: 'Usuarios', description: 'Editar usuarios y permisos' },
  { key: 'users.delete', label: 'Eliminar usuarios', module: 'Usuarios', description: 'Eliminar usuarios' },
];

export const ALL_PERMISSION_KEYS = PERMISSIONS.map((p) => p.key);

const ROLE_DEFAULTS: Record<string, string[]> = {
  ADMIN: ALL_PERMISSION_KEYS,
  MANAGER: ALL_PERMISSION_KEYS.filter((k) => k !== 'users.delete'),
  TECHNICIAN: [
    'inventory.view', 'inventory.create', 'inventory.edit', 'inventory.export',
    'sensitive.view_cost',
    'categories.view', 'categories.edit',
    'maintenance.view', 'maintenance.create',
    'loans.view', 'loans.create',
    'movements.view', 'movements.create',
    'reports.view', 'reports.export',
  ],
  VIEWER: [
    'inventory.view', 'categories.view', 'maintenance.view', 'loans.view',
    'movements.view', 'reports.view',
  ],
};

export function getEffectivePermissions(role: string, permissionsJson: unknown): string[] {
  const arr = Array.isArray(permissionsJson) ? permissionsJson : null;
  const parsed = arr && arr.every((x) => typeof x === 'string') ? (arr as string[]) : null;
  if (parsed !== null && parsed !== undefined) {
    return parsed;
  }
  return ROLE_DEFAULTS[role] ?? ROLE_DEFAULTS.VIEWER;
}

export function getDefaultPermissionsForRole(role: string): string[] {
  return ROLE_DEFAULTS[role] ?? ROLE_DEFAULTS.VIEWER;
}

export function canViewCost(permissions: string[]): boolean {
  return permissions.includes('sensitive.view_cost');
}

/** Quita precio de compra y costos de la respuesta si el usuario no tiene permiso */
export function stripCostFromResponse<T>(data: T, permissions: string[]): T {
  if (canViewCost(permissions)) return data;
  if (Array.isArray(data)) {
    return data.map((item) => stripCostFromResponse(item, permissions)) as T;
  }
  if (data && typeof data === 'object') {
    const out = { ...data } as Record<string, unknown>;
    if ('purchasePrice' in out) out.purchasePrice = undefined;
    if ('cost' in out) out.cost = undefined;
    return out as T;
  }
  return data;
}
