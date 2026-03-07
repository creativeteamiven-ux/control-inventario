import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import sharp from 'sharp';
import { PrismaClient } from '@prisma/client';
import { AppError } from '../middleware/errorHandler.js';
import { authenticate, AuthRequest, requireRole } from '../middleware/auth.js';

const router = Router();
const prisma = new PrismaClient();
// En Vercel el sistema de archivos es read-only excepto /tmp; usar /tmp para no romper el arranque
const uploadsDir = process.env.VERCEL ? path.join('/tmp', 'uploads') : path.join(process.cwd(), 'uploads');
const imagesDir = path.join(uploadsDir, 'images');
const docsDir = path.join(uploadsDir, 'documents');

try {
  [uploadsDir, imagesDir, docsDir].forEach((d) => {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  });
} catch {
  // En entornos serverless sin /tmp escribible, omitir; los endpoints de upload fallarán al usarse
}

const storageImages = multer.memoryStorage();
const storageDocs = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, docsDir),
  filename: (_req, file, cb) => cb(null, `${uuidv4()}-${file.originalname}`),
});

const uploadImages = multer({
  storage: storageImages,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!/^image\/(jpeg|png|webp|jpg)$/.test(file.mimetype)) {
      return cb(new Error('Solo imágenes JPEG, PNG o WebP'));
    }
    cb(null, true);
  },
});

const uploadDocs = multer({
  storage: storageDocs,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!/\.(pdf|doc|docx)$/i.test(file.originalname)) {
      return cb(new Error('Solo PDF o documentos Word'));
    }
    cb(null, true);
  },
});

router.use(authenticate);

router.post('/images', requireRole('ADMIN', 'MANAGER'), uploadImages.array('images', 5), async (req: AuthRequest, res, next) => {
  try {
    const files = req.files as Express.Multer.File[] | undefined;
    const deviceId = req.body.deviceId as string | undefined;
    if (!files?.length) throw new AppError(400, 'No se enviaron imágenes');
    const order = parseInt(req.body.order as string) || 0;
    const results: { url: string; id: string }[] = [];
    for (let i = 0; i < files.length; i++) {
      const buf = await sharp(files[i].buffer)
        .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toBuffer();
      const filename = `${uuidv4()}.jpg`;
      const filepath = path.join(imagesDir, filename);
      fs.writeFileSync(filepath, buf);
      const url = `/uploads/images/${filename}`;
      if (deviceId) {
        const img = await prisma.deviceImage.create({
          data: { deviceId, url, order: order + i },
        });
        results.push({ url, id: img.id });
      } else {
        results.push({ url, id: '' });
      }
    }
    res.json({ images: results });
  } catch (e) {
    next(e);
  }
});

router.post('/documents', requireRole('ADMIN', 'MANAGER'), uploadDocs.single('document'), async (req: AuthRequest, res, next) => {
  try {
    const file = req.file;
    const deviceId = req.body.deviceId as string;
    const type = (req.body.type as string) || 'manual';
    const name = req.body.name || file?.originalname || 'Documento';
    if (!file || !deviceId) throw new AppError(400, 'Falta archivo o deviceId');
    const url = `/uploads/documents/${file.filename}`;
    const doc = await prisma.document.create({
      data: { deviceId, name, type, url },
    });
    res.status(201).json({ id: doc.id, url, name });
  } catch (e) {
    next(e);
  }
});

export default router;
