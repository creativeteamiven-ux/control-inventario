/**
 * Función serverless de Vercel que delega TODAS las rutas `/api/*`
 * a la app Express compilada.
 *
 * Ejemplos que llegarán aquí:
 * - /api/auth/login
 * - /api/devices
 * - /api/maintenance/123
 */
export { default } from '../dist/index.js';

