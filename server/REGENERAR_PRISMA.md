# Solución: Error "location expected String, found YOUTH_ROOM"

El schema de Prisma ya tiene `location` como enum `DeviceLocation`, pero el **cliente generado** sigue usando el tipo anterior (String) porque no se ha podido ejecutar `prisma generate` con el servidor en marcha.

## Pasos (hazlo en este orden)

1. **Detén el servidor del backend**  
   En la terminal donde está corriendo `npm run dev` (o el servidor Node), pulsa **Ctrl+C**.

2. **Regenera el cliente de Prisma**  
   En la misma terminal (o en una nueva), ejecuta:
   ```bash
   cd server
   npx prisma generate
   ```

3. **Vuelve a iniciar el servidor**  
   Desde la raíz del proyecto:
   ```bash
   npm run dev
   ```
   O solo el backend desde `server`: `npm run dev`.

Después de esto, el inventario debería cargar los equipos sin el error de `location`.
