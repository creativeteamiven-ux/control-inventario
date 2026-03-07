/**
 * Entrada para Vercel: carga la app Express y responde con CORS siempre.
 * Si la carga falla, responde 500 con CORS en lugar de crashear.
 */
import express from 'express';

const CORS_HEADERS = {
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Credentials': 'true',
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

let mainAppPromise = null;
function getMainApp() {
  if (!mainAppPromise) {
    mainAppPromise = import('./dist/index.js').then((m) => m.default);
  }
  return mainAppPromise;
}

const wrapper = express();

// CORS en todas las respuestas y OPTIONS aquí para que nunca falle por CORS
wrapper.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && isAllowedOrigin(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

wrapper.use((req, res, next) => {
  getMainApp()
    .then((app) => app(req, res, next))
    .catch((err) => {
      console.error('Failed to load or run app:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Server error', message: err?.message || String(err) });
      }
    });
});

export default wrapper;
