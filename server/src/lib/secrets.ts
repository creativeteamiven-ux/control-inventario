/**
 * Secretos de firma. En producción el arranque ya falla si JWT_SECRET o
 * REFRESH_SECRET no están definidos (ver index.ts); aquí solo se centraliza la
 * lectura para no repetir valores por defecto por todo el código.
 */

const DEV_FALLBACK = 'soundvault-dev-only-secret-not-for-production';

function read(name: string, fallbackSuffix: string): string {
  const value = process.env[name];
  if (value && value.length >= 16) return value;
  return `${DEV_FALLBACK}:${fallbackSuffix}`;
}

export const JWT_SECRET = read('JWT_SECRET', 'access');
export const REFRESH_SECRET = read('REFRESH_SECRET', 'refresh');

/**
 * Secreto propio para los tokens de aprobación de movimientos: si se filtrara
 * el secreto de acceso, no basta para falsificar una autorización con PIN.
 */
export const APPROVAL_SECRET =
  process.env.APPROVAL_SECRET && process.env.APPROVAL_SECRET.length >= 16
    ? process.env.APPROVAL_SECRET
    : `${JWT_SECRET}:movement-approval`;

/** Algoritmo único aceptado al verificar cualquier token propio. */
export const JWT_ALGORITHMS = ['HS256'] as const;
