/**
 * Serverless function de Vercel que expone la app Express compilada.
 * Vercel creará una función en la ruta /api que delega todo a nuestra app.
 *
 * Peticiones como /api/auth/login llegarán aquí y serán manejadas por
 * las rutas registradas en src/index.ts (compiladas a dist/index.js).
 */
export { default } from '../dist/index.js';

