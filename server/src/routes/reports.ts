import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import PDFDocument from 'pdfkit';
import { authenticate, AuthRequest, requireRole } from '../middleware/auth.js';
import { stripCostFromResponse } from '../lib/permissions.js';

const router = Router();
const prisma = new PrismaClient();

router.use(authenticate);

router.get('/inventory', requireRole('ADMIN', 'MANAGER'), async (req, res, next) => {
  try {
    const categoryId = req.query.categoryId as string | undefined;
    const where: Record<string, unknown> = { deletedAt: null };
    if (categoryId) where.categoryId = categoryId;
    const devices = await prisma.device.findMany({
      where,
      include: { category: true, images: { take: 1, orderBy: { order: 'asc' } } },
      orderBy: [{ category: { name: 'asc' } }, { internalCode: 'asc' }],
    });
    const perms = (req as AuthRequest).user?.permissions ?? [];
    res.json(stripCostFromResponse(devices, perms));
  } catch (e) {
    next(e);
  }
});

router.get('/inventory/pdf', requireRole('ADMIN', 'MANAGER'), async (req, res, next) => {
  try {
    const devices = await prisma.device.findMany({
      where: { deletedAt: null },
      include: { category: true },
      orderBy: [{ category: { name: 'asc' } }, { internalCode: 'asc' }],
    });

    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    const pdfPromise = new Promise<Buffer>((resolve, reject) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
    });

    doc.fontSize(18).fillColor('#1E3A5F').text('The Warehouse - Reporte de Inventario', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor('#666').text(`Generado: ${new Date().toLocaleString('es-CL')}`, { align: 'center' });
    doc.moveDown(2);

    const colWidths = [55, 100, 55, 65, 75, 65, 90];
    const headers = ['Código', 'Nombre', 'Marca', 'Modelo', 'Categoría', 'Estado', 'Ubicación'];
    const startY = doc.y;

    doc.fontSize(9).fillColor('#fff');
    let y = startY;
    doc.rect(40, y, 515, 22).fill('#1E3A5F');
    doc.fillColor('#fff');
    let x = 45;
    headers.forEach((h, i) => {
      doc.text(h, x, y + 6, { width: colWidths[i], align: 'left' });
      x += colWidths[i];
    });
    y += 24;

    doc.fillColor('#333');
    devices.forEach((d, idx) => {
      if (y > 750) {
        doc.addPage();
        y = 40;
        doc.rect(40, y, 515, 22).fill('#1E3A5F');
        doc.fillColor('#fff');
        x = 45;
        headers.forEach((h, i) => {
          doc.text(h, x, y + 6, { width: colWidths[i], align: 'left' });
          x += colWidths[i];
        });
        y += 24;
        doc.fillColor('#333');
      }
      if (idx % 2 === 1) doc.rect(40, y, 515, 18).fill('#f5f5f5');
      const row = [
        d.internalCode,
        d.name,
        d.brand,
        d.model,
        d.category?.name ?? '',
        d.status,
        String(d.location).replace(/_/g, ' '),
      ];
      x = 45;
      row.forEach((val, i) => {
        doc.fillColor('#333').text(String(val).slice(0, 30), x, y + 4, { width: colWidths[i] });
        x += colWidths[i];
      });
      y += 20;
    });

    doc.moveDown(2);
    doc.fontSize(10).fillColor('#666').text(`Total equipos: ${devices.length} | The Warehouse`, { align: 'center' });

    doc.end();

    const pdf = await pdfPromise;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=inventario-thewarehouse.pdf');
    res.send(pdf);
  } catch (e) {
    next(e);
  }
});

export default router;
