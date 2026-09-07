/**
 * Origen permitido, resuelto por entorno.
 *
 * CLIENT_URL admite varias URLs separadas por coma.
 * PREVIEW_ORIGIN_PATTERN permite habilitar las previews del frontend sin tocar
 * el código (por ejemplo `control-inventario-02` para *.vercel.app).
 */

const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:5173')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const previewPattern = (process.env.PREVIEW_ORIGIN_PATTERN || '').trim();

export function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return true;
  if (allowedOrigins.includes(origin)) return true;
  if (
    previewPattern &&
    origin.startsWith('https://') &&
    origin.includes(previewPattern) &&
    origin.endsWith('.vercel.app')
  ) {
    return true;
  }
  return false;
}

/** Añade las cabeceras CORS si el origen está permitido. Usado también en 404 y errores. */
export function setCorsIfAllowed(
  res: { setHeader: (name: string, value: string) => void },
  origin: string | undefined
): void {
  if (!origin || !isAllowedOrigin(origin)) return;
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
}

export { allowedOrigins };
