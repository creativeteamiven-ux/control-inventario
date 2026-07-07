import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import sharp from 'sharp';
import { PrismaClient } from '@prisma/client';
import { AppError } from '../middleware/errorHandler.js';
import { authenticate, AuthRequest, requirePermission } from '../middleware/auth.js';
import { uploadBuffer, deleteByUrl } from '../lib/storage.js';

const router = Router();
const prisma = new PrismaClient();
const uploadsDir = path.join(process.cwd(), 'uploads');
const imagesDir = path.join(uploadsDir, 'images');
const docsDir = path.join(uploadsDir, 'documents');
const receiptsDir = path.join(uploadsDir, 'receipts');

try {
  [uploadsDir, imagesDir, docsDir, receiptsDir].forEach((d) => {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  });
} catch {
  // Ignorar si no se puede crear (p. ej. en serverless read-only)
}

const storageImages = multer.memoryStorage();
const storageDocs = multer.memoryStorage();

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

const storageReceipts = multer.memoryStorage();
const uploadReceipts = multer({
  storage: storageReceipts,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!/\.(pdf|jpe?g|png|webp)$/i.test(file.originalname)) {
      return cb(new Error('El comprobante debe ser PDF o imagen (JPG, PNG, WebP)'));
    }
    cb(null, true);
  },
});

router.use(authenticate);

router.post('/images', requirePermission('inventory.edit'), uploadImages.array('images', 5), async (req: AuthRequest, res, next) => {
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
      const url = await uploadBuffer(buf, 'images', `${uuidv4()}.jpg`);
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

router.delete('/images/:id', requirePermission('inventory.edit'), async (req: AuthRequest, res, next) => {
  try {
    const image = await prisma.deviceImage.findUnique({ where: { id: req.params.id } });
    if (!image) throw new AppError(404, 'Imagen no encontrada');
    await prisma.deviceImage.delete({ where: { id: image.id } });
    await deleteByUrl(image.url);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

router.post('/documents', requirePermission('inventory.edit'), uploadDocs.single('document'), async (req: AuthRequest, res, next) => {
  try {
    const file = req.file;
    const deviceId = req.body.deviceId as string;
    const type = (req.body.type as string) || 'manual';
    const name = req.body.name || file?.originalname || 'Documento';
    if (!file || !deviceId) throw new AppError(400, 'Falta archivo o deviceId');
    const url = await uploadBuffer(file.buffer, 'documents', file.originalname);
    const doc = await prisma.document.create({
      data: { deviceId, name, type, url },
    });
    res.status(201).json({ id: doc.id, url, name });
  } catch (e) {
    next(e);
  }
});

// Comprobante de gasto (imagen o PDF). Devuelve la URL para guardarla en Expense.receiptUrl.
router.post('/receipt', requirePermission('finance.manage'), uploadReceipts.single('receipt'), async (req: AuthRequest, res, next) => {
  try {
    const file = req.file;
    if (!file) throw new AppError(400, 'No se envió ningún comprobante');
    const url = await uploadBuffer(file.buffer, 'receipts', file.originalname);
    res.status(201).json({ url, name: file.originalname });
  } catch (e) {
    next(e);
  }
});

export default router;
