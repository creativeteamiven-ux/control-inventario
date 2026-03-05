# Configurar la base de datos SoundVault en Neon

Sigue estos pasos para crear la base del proyecto en tu cuenta de Neon (inicio con GitHub).

## 1. Crear el proyecto en Neon

1. Entra en **https://console.neon.tech** e inicia sesión con GitHub.
2. Haz clic en **"New Project"**.
3. Elige un **nombre** (por ejemplo: `soundvault`).
4. Selecciona la **región** más cercana (ej: East US).
5. Haz clic en **"Create Project"**.

## 2. Copiar la connection string

1. En el dashboard del proyecto, en **"Connection details"** verás la cadena de conexión.
2. Elige la pestaña **"Pooled connection"** (recomendado).
3. Copia la **connection string** completa. Se verá parecida a:
   ```
   postgresql://usuario:contraseña@ep-xxxxx-pooler.region.aws.neon.tech/neondb?sslmode=require
   ```

## 3. Configurar el proyecto

1. Abre el archivo **`server/.env`** (si no existe, copia `server/.env.example` y renómbralo a `.env`).
2. Pega la URL de Neon en la variable **`DATABASE_URL`**, **sin comillas** y en una sola línea:
   ```
   DATABASE_URL=postgresql://usuario:contraseña@ep-xxxxx-pooler.region.aws.neon.tech/neondb?sslmode=require
   ```
3. Asegúrate de tener también:
   ```
   JWT_SECRET=un-string-secreto-largo-y-aleatorio
   REFRESH_SECRET=otro-string-secreto-diferente
   PORT=3001
   CLIENT_URL=http://localhost:5173
   ```

## 4. Crear tablas y datos iniciales

En una terminal, desde la carpeta del proyecto:

```bash
cd server
npx prisma db push
npx prisma db seed
```

- **`db push`**: crea todas las tablas del schema en Neon.
- **`db seed`**: inserta el usuario admin, categorías y equipos de ejemplo.

## 5. Credenciales de acceso

Después del seed podrás entrar a la app con:

- **Email:** admin@soundvault.com  
- **Contraseña:** admin123  

---

Si Neon te muestra un **branch** (por ejemplo `main`), la connection string ya incluye la base de ese branch. No hace falta crear la base a mano; Neon la crea con el proyecto.
