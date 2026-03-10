# Checklist: Subir a producción

## Orden recomendado

1. **Neon (base de datos)** – asegurar que el esquema está actualizado.
2. **Render (backend)** – desplegar API.
3. **Vercel (frontend)** – desplegar cliente y apuntar a la API.

---

## 1. Neon (base de datos)

- Entra a [Neon Console](https://console.neon.tech) y copia la **Connection string** (Pooled) del proyecto. La usarás como `DATABASE_URL` en Render.
- Si cambiaste el esquema Prisma (`server/prisma/schema.prisma`), aplica los cambios en Neon:

  Desde tu máquina (con la URL de producción):

  ```bash
  cd server
  set DATABASE_URL=postgresql://...tu-url-neon...
  npx prisma db push
  ```

  O con un archivo `.env.production` en `server/` que solo tenga `DATABASE_URL` y luego:

  ```bash
  cd server
  npx dotenv -e .env.production -- npx prisma db push
  ```

  (Si usas `prisma migrate`, en su lugar: `npx prisma migrate deploy`.)

- No hace falta crear otro proyecto en Neon; usa el mismo que ya tengas.

---

## 2. Render (backend)

- Repositorio conectado en [Render](https://dashboard.render.com). Si usas `render.yaml`, el servicio ya puede estar creado.
- **Environment variables** del Web Service (Settings → Environment):

  | Variable        | Valor |
  |-----------------|--------|
  | `DATABASE_URL`  | Connection string de Neon (Pooled). |
  | `JWT_SECRET`    | String aleatorio largo (ej. `openssl rand -base64 32`). |
  | `REFRESH_SECRET`| Otro string aleatorio distinto. |
  | `CLIENT_URL`    | URL del frontend para CORS. Producción: `https://thewarehouse.diosfuentedepoder.com` (sin barra final). |
  | `NODE_ENV`      | `production` (opcional; Render suele inyectarlo). |

- **Build / Start:** según [docs/RENDER.md](RENDER.md): Root Directory vacío, Build: `cd packages/shared && npm install && npm run build && cd ../../server && npm install && npx prisma generate && npm run build`, Start: `cd server && node index.js`.
- Tras hacer **Deploy** (o push al repo si está el auto-deploy), anota la URL del API, ej. `https://control-inventario-api.onrender.com`.

---

## 3. Vercel (frontend)

- Crea (o usa) un **proyecto en Vercel** con el mismo repo de GitHub.
- **Configuración del proyecto:**
  - **Root Directory:** `client`
  - **Framework Preset:** Vite
  - **Install Command:** `cd ../packages/shared && npm install && npm run build && cd ../../client && npm install`
  - **Build Command:** `npm run build`
  - **Output Directory:** `dist`
- **Environment variable** (Production y Preview):

  | Variable       | Valor |
  |----------------|--------|
  | `VITE_API_URL` | URL del backend en Render, ej. `https://control-inventario-api.onrender.com` (sin barra final). |

- **Dominio de producción:** en Vercel → Settings → Domains, añade `thewarehouse.diosfuentedepoder.com` y configura el DNS según las instrucciones de Vercel.
- Guarda y haz **Deploy**. La URL del sitio en producción será `https://thewarehouse.diosfuentedepoder.com`.

---

## 4. Cerrar el círculo (CORS)

- En **Render** → tu Web Service → **Environment**: revisa que `CLIENT_URL` sea exactamente la URL del frontend (producción: `https://thewarehouse.diosfuentedepoder.com`), sin barra final.
- Si cambiaste `CLIENT_URL`, haz **Manual Deploy** en Render para que tome la variable.

---

## Resumen

| Dónde   | Qué hacer |
|---------|-----------|
| **Neon**  | Copiar connection string; si hay cambios en schema, ejecutar `prisma db push` (o `migrate deploy`) con `DATABASE_URL` de producción. |
| **Render**| Variables: `DATABASE_URL`, `JWT_SECRET`, `REFRESH_SECRET`, `CLIENT_URL`. Deploy del backend. |
| **Vercel**| Root: `client`. Variable `VITE_API_URL` = URL del backend en Render. Deploy del frontend. |

Después de hacer push al repo, Render y Vercel suelen redesplegar solos si tienen auto-deploy activado.
