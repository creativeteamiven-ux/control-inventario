/**
 * Almacenamiento de archivos configurable.
 * - Si hay credenciales de Cloudinary, sube allí (persistente en serverless/Render).
 * - Si no, guarda en disco local (uploads/) como respaldo para desarrollo.
 *
 * Variables: CLOUDINARY_URL  ó  CLOUDINARY_CLOUD_NAME + CLOUDINARY_API_KEY + CLOUDINARY_API_SECRET
 */
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { v2 as cloudinary } from 'cloudinary';

let cloudReady: boolean | null = null;

export function isCloudStorage(): boolean {
  if (cloudReady !== null) return cloudReady;
  if (process.env.CLOUDINARY_URL) {
    cloudinary.config({ secure: true });
    cloudReady = true;
  } else if (
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  ) {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
      secure: true,
    });
    cloudReady = true;
  } else {
    cloudReady = false;
  }
  return cloudReady;
}

const uploadsDir = path.join(process.cwd(), 'uploads');

const isProduction =
  process.env.NODE_ENV === 'production' || !!process.env.RENDER || !!process.env.VERCEL;

/**
 * En producción el disco del contenedor es efímero: sin Cloudinary los archivos
 * desaparecen en cada despliegue, así que se rechaza la subida en lugar de
 * aceptarla y perderla después.
 */
export function assertStorageConfigured(): void {
  if (isProduction && !isCloudStorage()) {
    throw new Error(
      'Almacenamiento no configurado: define CLOUDINARY_URL (o CLOUDINARY_CLOUD_NAME, ' +
        'CLOUDINARY_API_KEY y CLOUDINARY_API_SECRET) para poder guardar archivos en producción.'
    );
  }
}

/**
 * URL pública absoluta del backend, necesaria porque el frontend vive en otro
 * dominio y una ruta relativa como /uploads/... apuntaría al del frontend.
 */
function publicBaseUrl(): string {
  const explicit = process.env.PUBLIC_API_URL || process.env.RENDER_EXTERNAL_URL;
  if (explicit) return explicit.replace(/\/$/, '');
  return '';
}

/**
 * Sube un buffer y devuelve la URL pública.
 * @param folder subcarpeta lógica (images, receipts, documents)
 * @param originalName nombre original (para extensión)
 */
export async function uploadBuffer(
  buffer: Buffer,
  folder: string,
  originalName: string
): Promise<string> {
  assertStorageConfigured();
  if (isCloudStorage()) {
    const isImage = /\.(jpe?g|png|webp|gif)$/i.test(originalName);
    const result = await new Promise<{ secure_url: string }>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: `thewarehouse/${folder}`, resource_type: isImage ? 'image' : 'raw' },
        (err, res) => {
          if (err || !res) return reject(err || new Error('Error subiendo a Cloudinary'));
          resolve(res as { secure_url: string });
        }
      );
      stream.end(buffer);
    });
    return result.secure_url;
  }

  // Respaldo local
  const dir = path.join(uploadsDir, folder);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const ext = path.extname(originalName) || '';
  const filename = `${uuidv4()}${ext}`;
  fs.writeFileSync(path.join(dir, filename), buffer);
  return `${publicBaseUrl()}/uploads/${folder}/${filename}`;
}

/**
 * Elimina un archivo por su URL pública (best-effort).
 * - Cloudinary: extrae el public_id y lo borra.
 * - Local: borra el archivo del disco.
 * Nunca lanza: los errores se ignoran para no bloquear la operación principal.
 */
export async function deleteByUrl(url: string): Promise<void> {
  if (!url) return;
  try {
    if (/res\.cloudinary\.com/.test(url) || (isCloudStorage() && !url.startsWith('/uploads/'))) {
      // Extraer public_id: todo lo que va después de /upload/ (quitando versión y extensión)
      const match = url.match(/\/upload\/(?:v\d+\/)?(.+)$/);
      if (match) {
        const publicId = match[1].replace(/\.[^/.]+$/, '');
        await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
      }
      return;
    }
    const localPath = url.startsWith('/uploads/')
      ? url
      : url.includes('/uploads/')
        ? url.slice(url.indexOf('/uploads/'))
        : null;
    if (localPath) {
      const filePath = path.join(process.cwd(), localPath.replace(/^\//, ''));
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
  } catch {
    // Ignorar errores de borrado de almacenamiento
  }
}
