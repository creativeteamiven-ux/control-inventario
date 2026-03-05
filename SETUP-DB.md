# Configurar Base de Datos

El error 500 en login ocurre porque **PostgreSQL no está corriendo**. Elige una opción:

---

## Opción 1: Neon (PostgreSQL gratis en la nube) — **Recomendado**

1. Ve a **[https://neon.tech](https://neon.tech)** y regístrate (gratis con GitHub/Google)
2. Crea un **proyecto** nuevo
3. En el panel, haz clic en **Connect** y copia la **Connection string**
4. Pega la URL en `server/.env` reemplazando `DATABASE_URL`:
   ```
   DATABASE_URL="postgresql://usuario:password@ep-xxx.region.aws.neon.tech/neondb?sslmode=require"
   ```
5. En la terminal:
   ```bash
   cd server
   npx prisma db push
   npx prisma db seed
   ```
6. Reinicia el servidor (Ctrl+C y `npm run dev`)

---

## Opción 2: Docker (si tienes Docker Desktop)

```bash
docker run -d --name soundvault-db -p 5432:5432 -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=soundvault postgres:16-alpine
```

Luego:
```bash
cd server
npx prisma db push
npx prisma db seed
```

---

## Opción 3: PostgreSQL local

1. Instala PostgreSQL desde [postgresql.org](https://www.postgresql.org/download/windows/)
2. Crea la base de datos `soundvault`
3. El `.env` ya tiene `postgresql://postgres:postgres@localhost:5432/soundvault`
4. Ejecuta:
   ```bash
   cd server
   npx prisma db push
   npx prisma db seed
   ```
