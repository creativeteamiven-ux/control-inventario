# SoundVault — Sistema de Gestión de Inventario de Audio

Sistema full-stack para gestionar el inventario de equipos de audio de iglesia y estudio de grabación. Desplegable en subdominio (ej: inventario.iglesia.com).

> **Especificación completa del proyecto:** [docs/PROJECT_SPEC.md](docs/PROJECT_SPEC.md) — stack, diseño, módulos, BD y features. Úsala como referencia (ej: `@docs/PROJECT_SPEC.md`) en el asistente.

## Stack

- **Frontend**: React 18, Vite, TypeScript, TailwindCSS, TanStack Query, Recharts
- **Backend**: Node.js, Express, TypeScript, Prisma, PostgreSQL
- **Auth**: JWT con refresh token

## Desarrollo local

### Requisitos

- Node.js 20+
- PostgreSQL 16+
- npm

### 1. Instalar dependencias

```bash
npm install
cd packages/shared && npm run build
cd ../../server && npm install && npx prisma generate
cd ../client && npm install
```

### 2. Base de datos

Crear base de datos PostgreSQL `soundvault` y configurar `server/.env`:

```
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/soundvault?schema=public"
JWT_SECRET="dev-secret"
REFRESH_SECRET="dev-refresh"
PORT=3001
CLIENT_URL="http://localhost:5173"
```

```bash
cd server
npx prisma db push
npx prisma db seed
```

### 3. Ejecutar

**Una sola terminal (recomendado en Windows):**

```bash
npm run dev:local
```

**O en dos terminales:**

```bash
# Terminal 1 - backend
cd server && npm run dev

# Terminal 2 - frontend
cd client && npm run dev
```

- Frontend: http://localhost:5173
- API: http://localhost:3001

### Credenciales demo

- Email: admin@soundvault.com
- Contraseña: admin123

## Docker

```bash
docker-compose up -d
```

- Frontend: http://localhost
- Backend: http://localhost:3001

## Despliegue

- **Backend (API):** [docs/RENDER.md](docs/RENDER.md) — Render Web Service.
- **Frontend + BD:** [docs/VERCEL_NEON.md](docs/VERCEL_NEON.md) — Vercel + Neon (frontend); la API puede ir en Render.

## Estructura

```
├── client/          # Frontend React + Vite
├── server/          # Backend Express + Prisma
├── packages/shared/ # Schemas Zod compartidos
└── docker-compose.yml
```
