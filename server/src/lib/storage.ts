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
  return `/uploads/${folder}/${filename}`;
}
