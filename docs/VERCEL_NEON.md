# Despliegue en Vercel + Neon (misma cuenta GitHub)

Usa la **misma base Neon** que en desarrollo. Dos proyectos en Vercel, mismo repositorio Git.

---

## 1. Neon (una sola base)

- Usa el proyecto que ya tienes en [Neon](https://console.neon.tech).
- Copia la **Connection string** (Pooled) desde el dashboard del proyecto.
- La usarás en el **proyecto Backend** de Vercel como `DATABASE_URL`.

---

## 2. Vercel – Proyecto BACKEND (API)

1. En [Vercel](https://vercel.com) → **Add New** → **Project**.
2. Importa el repo de GitHub (el mismo que usas para el código).
3. **Configuración del proyecto:**
   - **Project Name:** por ejemplo `soundvault-api`.
   - **Root Directory:** `server` (editar y poner `server`).
   - **Framework Preset:** Other.
   - **Build Command:**
     ```bash
     cd ../packages/shared && npm run build && cd ../server && npm run build
     ```
   - **Output Directory:** (dejar vacío; la app se sirve como función).
   - **Install Command:** `npm install` (se ejecuta dentro de `server`; el mono-repo incluye `../packages/shared`).

4. **Variables de entorno** (Settings → Environment Variables), para **Production** (y Preview si quieres):

   | Variable         | Valor |
   |------------------|--------|
   | `DATABASE_URL`   | La connection string de Neon (Pooled) que copiaste. |
   | `JWT_SECRET`     | Un string largo y aleatorio (ej. generado con `openssl rand -base64 32`). |
   | `REFRESH_SECRET` | Otro string largo y aleatorio, distinto a `JWT_SECRET`. |
   | `CLIENT_URL`     | URL del front en Vercel, ej. `https://soundvault.vercel.app` (la sustituyes por la URL real del proyecto Frontend). |
   | `PORT`           | No hace falta en Vercel; lo inyecta el runtime. |

5. Deploy. La URL de la API será algo como `https://soundvault-api.vercel.app`. **Cópiala** para el frontend.

---

## 3. Vercel – Proyecto FRONTEND

1. **Add New** → **Project** → mismo repo de GitHub.
2. **Configuración:**
   - **Project Name:** por ejemplo `soundvault` o `soundvault-app`.
   - **Root Directory:** dejar vacío (raíz del repo).
   - **Framework Preset:** Vite.
   - **Install Command:** `cd packages/shared && npm install && cd ../../client && npm install`
   - **Build Command:** `cd packages/shared && npm run build && cd ../client && npm run build`
   - **Output Directory:** `client/dist`

3. **Variable de entorno** (Production y Preview):

   | Variable        | Valor |
   |-----------------|--------|
   | `VITE_API_URL`  | URL del backend en Vercel, ej. `https://soundvault-api.vercel.app` (sin barra final). |

4. Deploy. La URL del sitio será algo como `https://soundvault.vercel.app`.

---

## 4. Cerrar el círculo (CORS)

- Vuelve al proyecto **Backend** en Vercel.
- En **Environment Variables**, edita `CLIENT_URL` y pon **exactamente** la URL del frontend (ej. `https://soundvault.vercel.app`), sin barra final.
- Redeploy del backend para que coja la nueva variable.

---

## 5. Resumen

| Dónde    | Root Directory | Build Command |
|----------|----------------|----------------|
| Backend  | `server`       | `cd ../packages/shared && npm run build && cd ../server && npm run build` |
| Frontend | (vacío)        | Install: `cd packages/shared && npm install && cd ../client && npm install` · Build: `cd packages/shared && npm run build && cd ../client && npm run build` |

- **Neon:** una sola base; su connection string va en el Backend como `DATABASE_URL`.
- **Vercel:** dos proyectos (Backend y Frontend), mismo repo Git; el front llama al backend con `VITE_API_URL` y el backend acepta el origen con `CLIENT_URL`.
