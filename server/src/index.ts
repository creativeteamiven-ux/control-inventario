/**
 * The Warehouse - Backend API
 * Sistema de Gestión de Inventario
 */
import 'express-async-errors';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import compression from 'compression';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { prisma } from './lib/prisma.js';

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
import locationsRouter from './routes/locations.js';
import expensesRouter from './routes/expenses.js';
import budgetsRouter from './routes/budgets.js';
import alertsRouter from './routes/alerts.js';
import auditRouter from './routes/audit.js';
import eventsRouter from './routes/events.js';
import securityRouter from './routes/security.js';
import { errorHandler } from './middleware/errorHandler.js';
import { startAlertScheduler } from './lib/scheduler.js';
import { ensureEventTables } from './lib/ensureEventTables.js';
import { ensureSchemaCompat } from './lib/ensureSchemaCompat.js';
import { ensureAuthSecurity } from './lib/ensureAuthSecurity.js';
import { isAllowedOrigin, setCorsIfAllowed, allowedOrigins } from './lib/cors.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// En Vercel (Root Directory = server) no hay carpeta padre; cargar .env desde el mismo directorio que index.js
const envDir = __dirname;

// Entornos: .env (base) → .env.local (override local) → .env.development / .env.production
dotenv.config({ path: path.join(envDir, '.env') });
dotenv.config({ path: path.join(envDir, '.env.local') });
const nodeEnv = process.env.NODE_ENV || 'development';
dotenv.config({ path: path.join(envDir, `.env.${nodeEnv}`) });

// Seguridad: en producción NO permitimos arrancar con secrets por defecto/ausentes.
const isProduction = nodeEnv === 'production' || !!process.env.RENDER || !!process.env.VERCEL;
if (isProduction) {
  const missing = ['JWT_SECRET', 'REFRESH_SECRET'].filter((k) => !process.env[k] || process.env[k]!.length < 16);
  if (missing.length) {
    console.error(
      `[Seguridad] Falta(n) variable(s) de entorno obligatoria(s) o son demasiado cortas: ${missing.join(', ')}. ` +
        'Define secrets largos y aleatorios en el entorno de producción.'
    );
    throw new Error('Secrets de producción no configurados correctamente');
  }
}

const app = express();
const PORT = Number(process.env.PORT) || 3001;

// Cabeceras de seguridad. Como es una API separada del frontend, deshabilitamos CSP
// (devuelve JSON) y permitimos que /uploads se consuma de otro origen.
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

// Límite de peticiones general (anti-abuso) y uno más estricto para autenticación (anti fuerza bruta).
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
});
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.' },
});

const pinLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos de PIN. Espera unos minutos e inténtalo de nuevo.' },
});

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
app.use(compression());
app.use(express.json({ limit: '2mb' }));

/**
 * Health check para el balanceador: solo comprueba conexión a la base.
 * El estado de las tablas de eventos se consulta aparte para que un problema
 * en ese módulo no marque todo el servicio como caído.
 */
app.get('/api/health', async (_req, res) => {
  setCorsIfAllowed(res, _req.headers.origin);
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true, db: 'connected' });
  } catch (e) {
    console.error('[Health] DB error:', (e as Error).message);
    res.status(503).json({ ok: false, db: 'error' });
  }
});

app.get('/api/health/events', async (_req, res) => {
  setCorsIfAllowed(res, _req.headers.origin);
  try {
    await prisma.event.count();
    res.json({ ok: true, events: 'ready' });
  } catch (e) {
    console.error('[Health] Events error:', (e as Error).message);
    res.status(503).json({ ok: false, events: 'missing' });
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

// Detrás de proxy (Render/Vercel) para que el rate-limit identifique bien la IP del cliente.
app.set('trust proxy', 1);

// Rutas API
app.use('/api', generalLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/refresh', authLimiter);
app.use('/api/security/pin/verify', pinLimiter);
app.use('/api/security/pin', pinLimiter);
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
app.use('/api/locations', locationsRouter);
app.use('/api/expenses', expensesRouter);
app.use('/api/budgets', budgetsRouter);
app.use('/api/alerts', alertsRouter);
app.use('/api/audit', auditRouter);
app.use('/api/events', eventsRouter);
app.use('/api/security', securityRouter);

// Archivos estáticos (uploads). Nombres con UUID, así que se pueden cachear largo.
app.use(
  '/uploads',
  express.static(path.join(__dirname, 'uploads'), {
    maxAge: '7d',
    immutable: true,
    fallthrough: true,
  })
);

// 404 con CORS para que el navegador no bloquee por política CORS
app.use((req, res) => {
  setCorsIfAllowed(res, req.headers.origin);
  res.status(404).json({ error: 'No encontrado', path: req.path });
});

app.use(errorHandler);

/**
 * En producción un fallo aquí deja la API a medias, así que se registra como
 * crítico y se aborta el arranque para que el orquestador reintente en lugar de
 * servir tráfico con un esquema incompleto.
 */
async function bootDb() {
  try {
    console.log('[DB] Verificando schema y tablas de eventos...');
    await ensureSchemaCompat(prisma);
    await ensureEventTables(prisma);
    await ensureAuthSecurity(prisma);
    console.log('[DB] Schema y tablas de eventos OK');
  } catch (err) {
    console.error('[DB] Error CRÍTICO en boot DB:', (err as Error).message);
    if (isProduction) throw err;
  }
}

// Sin estos manejadores, una promesa rechazada puede tumbar el proceso sin rastro.
process.on('unhandledRejection', (reason) => {
  console.error('[Proceso] unhandledRejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[Proceso] uncaughtException:', err);
  void prisma.$disconnect().finally(() => process.exit(1));
});
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => {
    console.log(`[Proceso] ${signal} recibido, cerrando conexiones...`);
    void prisma.$disconnect().finally(() => process.exit(0));
  });
}

// En Vercel la app se exporta y la ejecuta el runtime serverless; localmente arrancamos el servidor
export default app;

if (process.env.VERCEL) {
  void bootDb();
} else {
  const host = process.env.RENDER ? '0.0.0.0' : 'localhost';
  void (async () => {
    await bootDb();
    app.listen(PORT, host, () => {
      console.log(`🚀 The Warehouse API running on http://${host}:${PORT}`);
      startAlertScheduler(prisma);
    });
  })();
}
