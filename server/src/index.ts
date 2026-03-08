/**
 * SoundVault - Backend API
 * Sistema de Gestión de Inventario de Audio
 */
import 'express-async-errors';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

import { PrismaClient } from '@prisma/client';
import authRouter from './routes/auth.js';
import devicesRouter from './routes/devices.js';
import categoriesRouter from './routes/categories.js';
import maintenanceRouter from './routes/maintenance.js';
import loansRouter from './routes/loans.js';
import movementsRouter from './routes/movements.js';
import reportsRouter from './routes/reports.js';
import uploadRouter from './routes/upload.js';
import templatesRouter from './routes/templates.js';
import importExportRouter from './routes/importExport.js';
import dashboardRouter from './routes/dashboard.js';
import usersRouter from './routes/users.js';
import { errorHandler } from './middleware/errorHandler.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// En Vercel (Root Directory = server) no hay carpeta padre; cargar .env desde el mismo directorio que index.js
const envDir = __dirname;

// Entornos: .env (base) → .env.local (override local) → .env.development / .env.production
dotenv.config({ path: path.join(envDir, '.env') });
dotenv.config({ path: path.join(envDir, '.env.local') });
const nodeEnv = process.env.NODE_ENV || 'development';
dotenv.config({ path: path.join(envDir, `.env.${nodeEnv}`) });

const app = express();
const PORT = process.env.PORT || 3001;

// CORS: permitir CLIENT_URL (puede ser varias separadas por coma) y previews de Vercel del frontend
const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:5173')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const isAllowedOrigin = (origin: string | undefined): boolean => {
  if (!origin) return true;
  if (allowedOrigins.includes(origin)) return true;
  // Producción y previews de Vercel del frontend (cualquier subdominio que contenga el nombre del proyecto)
  if (
    origin.startsWith('https://') &&
    origin.includes('control-inventario-02') &&
    origin.endsWith('.vercel.app')
  ) {
    return true;
  }
  return false;
};

// Preflight OPTIONS primero: en Vercel serverless el preflight debe recibir cabeceras CORS explícitas
app.options('*', (req, res) => {
  const origin = req.headers.origin;
  if (origin && isAllowedOrigin(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Max-Age', '86400');
  res.sendStatus(204);
});

app.use(
  cors({
    origin: (origin, callback) => {
      callback(null, isAllowedOrigin(origin) ? origin : false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);
app.use(express.json());

// Diagnóstico: comprobar que la API y la DB responden
const prisma = new PrismaClient();
app.get('/api/health', async (_req, res) => {
  const origin = _req.headers.origin;
  if (origin && isAllowedOrigin(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true, db: 'connected' });
  } catch (e) {
    const err = e as Error;
    console.error('[Health] DB error:', err.message);
    res.status(500).json({ ok: false, db: 'error', message: err.message });
  }
});

// Raíz: mensaje para quien abra la URL del backend en el navegador
app.get('/', (_req, res) => {
  res.json({
    name: 'SoundVault API',
    version: '1.0',
    docs: 'Esta es la API del backend. Usa el frontend para acceder a la aplicación.',
    health: '/api/health',
  });
});

// Rutas API
app.use('/api/auth', authRouter);
app.use('/api/devices', devicesRouter);
app.use('/api/categories', categoriesRouter);
app.use('/api/maintenance', maintenanceRouter);
app.use('/api/loans', loansRouter);
app.use('/api/movements', movementsRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/upload', uploadRouter);
app.use('/api/templates', templatesRouter);
app.use('/api/import', importExportRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/users', usersRouter);

// Archivos estáticos (uploads)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// 404 con CORS para que el navegador no bloquee por política CORS
app.use((req, res) => {
  const origin = req.headers.origin;
  if (origin && isAllowedOrigin(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  res.status(404).json({ error: 'No encontrado', path: req.path });
});

app.use(errorHandler);

// En Vercel la app se exporta y la ejecuta el runtime serverless; localmente arrancamos el servidor
export default app;

if (!process.env.VERCEL) {
  const host = process.env.RENDER ? '0.0.0.0' : 'localhost';
  app.listen(PORT, host, () => {
    console.log(`🚀 SoundVault API running on http://${host}:${PORT}`);
  });
}
