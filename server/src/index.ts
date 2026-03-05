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
const envDir = path.join(__dirname, '..');

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
app.use(
  cors({
    origin: (origin, callback) => {
      callback(null, isAllowedOrigin(origin) ? origin : false);
    },
    credentials: true,
  })
);
app.use(express.json());

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
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.use(errorHandler);

// En Vercel la app se exporta y la ejecuta el runtime serverless; localmente arrancamos el servidor
export default app;

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`🚀 SoundVault API running on http://localhost:${PORT}`);
  });
}
