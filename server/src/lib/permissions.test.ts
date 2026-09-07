import { describe, it, expect } from 'vitest';
import { sanitizePermissions, ALL_PERMISSION_KEYS } from './permissions.js';

describe('sanitizePermissions', () => {
  it('descarta claves que no existen', () => {
    const result = sanitizePermissions(['inventory.view', 'super.admin', ''], 'ADMIN');
    expect(result).toEqual(['inventory.view']);
  });

  it('un ADMIN puede otorgar cualquier permiso válido', () => {
    const result = sanitizePermissions(ALL_PERMISSION_KEYS, 'ADMIN');
    expect(result).toHaveLength(ALL_PERMISSION_KEYS.length);
  });

  it('un MANAGER no puede otorgar permisos que su rol no tiene', () => {
    const result = sanitizePermissions(['inventory.view', 'users.delete'], 'MANAGER');
    expect(result).toContain('inventory.view');
    expect(result).not.toContain('users.delete');
  });

  it('un VIEWER no puede otorgar permisos de escritura', () => {
    const result = sanitizePermissions(['inventory.view', 'inventory.delete'], 'VIEWER');
    expect(result).toEqual(['inventory.view']);
  });

  it('elimina duplicados', () => {
    const result = sanitizePermissions(['inventory.view', 'inventory.view'], 'ADMIN');
    expect(result).toEqual(['inventory.view']);
  });
});
