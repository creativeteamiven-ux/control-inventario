# Despliegue del backend en Render

El backend (API Node.js + Express) se despliega en [Render](https://render.com) como **Web Service**. El frontend puede seguir en Vercel u otro host.

## 1. Requisitos

- Cuenta en [Render](https://render.com)
- Repositorio en GitHub (el mismo del proyecto)
- Base de datos PostgreSQL (Neon, Render Postgres o cualquier Postgres con URL de conexión)

## 2. Crear el Web Service en Render

### Opción A: Desde el Dashboard (recomendado la primera vez)

1. En [Render Dashboard](https://dashboard.render.com) → **New** → **Web Service**.
2. Conecta el repositorio de GitHub (creativeteamiven-ux/control-inventario o el que uses).
3. Configuración:
   - **Name:** `control-inventario-api` (o el que prefieras).
   - **Region:** Oregon (o la más cercana a tus usuarios).
   - **Root Directory:** `server`
   - **Runtime:** Node
   - **Build Command:**
     ```bash
     cd ../packages/shared && npm install && npm run build && cd ../../server && npm install && npx prisma generate && npm run build
     ```
   - **Start Command:** `node index.js`
   - **Instance Type:** Free o Starter según necesidad.

4. **Environment Variables** (Settings → Environment):

   | Variable         | Descripción |
   |------------------|-------------|
   | `DATABASE_URL`   | Connection string de PostgreSQL (Neon, Render Postgres, etc.). |
   | `JWT_SECRET`     | String largo y aleatorio para los access tokens. |
   | `REFRESH_SECRET` | Otro string distinto para los refresh tokens. |
   | `CLIENT_URL`     | URL del frontend (ej. `https://control-inventario-02.vercel.app`) para CORS. |
   | `NODE_ENV`       | `production` (Render suele inyectarlo; opcional). |

5. **Save** y deja que Render haga el primer deploy. La URL del API será algo como `https://control-inventario-api.onrender.com`.

### Opción B: Blueprint (render.yaml)

En la raíz del repo está `render.yaml`. En Render puedes usar **New** → **Blueprint** y apuntar al repo para que cree el servicio desde ese archivo. Luego añade en el Dashboard las variables `DATABASE_URL`, `JWT_SECRET`, `REFRESH_SECRET` y `CLIENT_URL` (no se suelen poner secretos en el YAML).

## 3. Conectar el frontend al backend en Render

En el proyecto del **frontend** (p. ej. en Vercel):

- Variable de entorno **`VITE_API_URL`** = URL del backend en Render, sin barra final.  
  Ejemplo: `https://control-inventario-api.onrender.com`

Vuelve a desplegar el frontend para que use la nueva API.

## 4. CORS

El backend permite orígenes definidos en `CLIENT_URL` (varios separados por coma). Asegúrate de que la URL exacta del frontend (con `https://`, sin barra final) esté en `CLIENT_URL` en Render.

## 5. Health check

Render usa por defecto la raíz `/`. El backend expone **GET /api/health** para comprobar que la API y la base de datos responden. En **Settings** del Web Service puedes poner **Health Check Path:** `/api/health`.

## 6. Notas

- **Free tier:** el servicio puede “dormir” tras inactividad; la primera petición puede tardar más.
- **Uploads:** los archivos subidos se guardan en el disco del servicio. En plan Free no hay disco persistente entre deploys; para producción conviene usar almacenamiento externo (S3, Vercel Blob, etc.) si necesitas persistencia.
- **Puerto:** Render inyecta `PORT`; el servidor escucha en `0.0.0.0` cuando está en Render para aceptar conexiones externas.
