# Checklist: Subir a producción

Arquitectura actual: **base de datos MySQL/TiDB** + **API en Render** + **frontend en Vercel**.

> El esquema de Prisma usa `provider = "mysql"`. Los documentos que hablan de
> Neon y PostgreSQL corresponden a una etapa anterior del proyecto.

## Orden recomendado

1. **Base de datos** – aplicar migraciones.
2. **Render (backend)** – desplegar API.
3. **Vercel (frontend)** – desplegar cliente y apuntar a la API.

---

## 1. Base de datos (MySQL / TiDB)

El despliegue aplica migraciones versionadas con `prisma migrate deploy` (ya no
se usa `prisma db push`, que sincroniza el esquema sin historial y puede alterar
columnas en producción).

La base de producción se creó en su día con `db push`, así que sus tablas ya
existen sin estar registradas como migración. Ese baseline ya está resuelto y no
hay que repetirlo:

- El esquema inicial **no** vive en `prisma/migrations`, sino en
  `server/prisma/baseline/0_init.sql`. Está fuera a propósito (ver el README de
  esa carpeta) y no se aplica en los despliegues.
- `20260831_events` ya figura como aplicada en `_prisma_migrations`.

Por eso el Build Command solo necesita `prisma migrate deploy`, que aplica las
migraciones nuevas y nada más.

Si algún día levantas una base **desde cero**, aplica primero
`server/prisma/baseline/0_init.sql` a mano y después marca la de eventos como
aplicada, antes del primer deploy:

```bash
cd server
npx prisma migrate resolve --applied 20260831_events
```

Para cambios de esquema nuevos: `npx prisma migrate dev --name descripcion` en
local y commit de la carpeta generada en `server/prisma/migrations/`.

---

## 2. Render (backend)

- Repositorio conectado en [Render](https://dashboard.render.com).
- **Atención:** el servicio actual se creó a mano, no como Blueprint, así que
  Render **no lee `render.yaml`**. Los comandos hay que mantenerlos en Settings
  → Build & Deploy, y `render.yaml` solo sirve de referencia (o para recrear el
  servicio como Blueprint más adelante).
- **Build Command** (una sola línea; sube dos niveles desde `packages/shared`,
  porque `packages/server` no existe):

  ```bash
  cd packages/shared && npm install && npm run build && cd ../../server && npm install && npx prisma generate && npx prisma migrate deploy && npm run build
  ```

- **Start Command:** `cd server && node index.js`. No debe incluir
  `prisma db push`: parchearía el esquema en cada arranque y anularía el
  historial de migraciones.
- **Root Directory:** vacío. El build necesita ver `packages/shared`.
- **Environment variables** del Web Service (Settings → Environment):

  | Variable | Obligatoria | Valor |
  |----------|-------------|-------|
  | `DATABASE_URL` | Sí | Cadena de conexión MySQL/TiDB. |
  | `JWT_SECRET` | Sí | Aleatorio, mínimo 16 caracteres (`openssl rand -base64 32`). |
  | `REFRESH_SECRET` | Sí | Otro distinto. |
  | `CLIENT_URL` | Sí | URL(es) del frontend separadas por coma, sin barra final. |
  | `CLOUDINARY_URL` | Sí | El disco de Render es efímero: sin esto se pierden imágenes y comprobantes en cada despliegue, y la API rechaza las subidas. |
  | `PUBLIC_API_URL` | Recomendada | URL pública del backend, para que las rutas `/uploads` sean absolutas. |
  | `APPROVAL_SECRET` | Recomendada | Secreto propio de los tokens de PIN/biometría. Si falta, se deriva de `JWT_SECRET`. |
  | `PREVIEW_ORIGIN_PATTERN` | Opcional | Fragmento del nombre del proyecto en Vercel para permitir previews. |
  | `ALERT_CRON_SECRET` | Opcional | Para el cron externo de alertas (cabecera `x-cron-secret`). |
  | `NODE_ENV` | — | `production` (Render suele inyectarlo). |

- El arranque **falla a propósito** si `JWT_SECRET` o `REFRESH_SECRET` faltan o
  son demasiado cortos.
- Tras el **Deploy**, anota la URL del API, por ejemplo
  `https://control-inventario-api.onrender.com`.
- **Plan gratuito:** el servicio se duerme tras unos 15 minutos sin tráfico (la
  primera petición tarda entre 30 y 60 segundos) y el cron interno de alertas no
  corre mientras duerme. Con plan Starter o un cron externo que llame a
  `/api/health` se evita.

---

## 3. Vercel (frontend)

- Proyecto en Vercel con el mismo repositorio.
- **Configuración del proyecto:**
  - **Root Directory:** `client`
  - **Framework Preset:** Vite
  - **Install Command:** `cd ../packages/shared && npm install && npm run build && cd ../../client && npm install`
  - **Build Command:** `npm run build`
  - **Output Directory:** `dist`
- **Environment variable** (Production y Preview):

  | Variable | Valor |
  |----------|-------|
  | `VITE_API_URL` | URL del backend en Render, sin barra final. |

- **Dominio de producción:** Settings → Domains.

---

## 4. Cerrar el círculo (CORS)

- `CLIENT_URL` en Render debe coincidir exactamente con la URL del frontend, sin
  barra final. Admite varias separadas por coma.
- Para las previews de Vercel, define `PREVIEW_ORIGIN_PATTERN` con un fragmento
  del nombre del proyecto (ya no hay dominios escritos en el código).
- Si cambias cualquiera de las dos, haz **Manual Deploy** para que Render tome la
  variable.

---

## 5. Comprobación posterior

```bash
curl https://tu-api.onrender.com/api/health          # {"ok":true,"db":"connected"}
curl https://tu-api.onrender.com/api/health/events   # {"ok":true,"events":"ready"}
```

Después, en la aplicación: iniciar sesión, abrir el inventario, subir una imagen
y comprobar que se ve (confirma que Cloudinary está bien configurado).

---

## Resumen

| Dónde | Qué hacer |
|-------|-----------|
| **Base de datos** | Baseline la primera vez; después `migrate deploy` corre solo en el build. |
| **Render** | Variables obligatorias incluida `CLOUDINARY_URL`. Deploy del backend. |
| **Vercel** | Root `client`, `VITE_API_URL` = URL del backend. Deploy del frontend. |

Con auto-deploy activado, un push a `main` redespliega Render y Vercel.
