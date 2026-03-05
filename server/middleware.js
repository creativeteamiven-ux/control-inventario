/**
 * Edge Middleware: responde OPTIONS (preflight CORS) en el edge y añade cabeceras CORS
 * a las respuestas de la API. Así el preflight siempre tiene cabeceras aunque la función
 * no las devuelva a tiempo.
 */
import { next } from '@vercel/functions';

const CORS_HEADERS = {
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Max-Age': '86400',
};

function isAllowedOrigin(origin) {
  if (!origin) return true;
  if (origin === 'http://localhost:5173') return true;
  return (
    origin.startsWith('https://') &&
    origin.includes('control-inventario-02') &&
    origin.endsWith('.vercel.app')
  );
}

export const config = {
  matcher: '/api/:path*',
};

export default function middleware(request) {
  const origin = request.headers.get('origin') || '';

  if (request.method === 'OPTIONS') {
    const headers = { ...CORS_HEADERS };
    if (origin && isAllowedOrigin(origin)) {
      headers['Access-Control-Allow-Origin'] = origin;
    }
    return new Response(null, { status: 204, headers });
  }

  const headers = {};
  if (origin && isAllowedOrigin(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
    Object.assign(headers, CORS_HEADERS);
  }
  return next({ headers });
}
