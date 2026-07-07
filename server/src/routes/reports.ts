import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import PDFDocument from 'pdfkit';
import * as XLSX from 'xlsx';
import { authenticate, AuthRequest, requirePermission } from '../middleware/auth.js';
import { stripCostFromResponse } from '../lib/permissions.js';
import { computeDepreciation } from '../lib/depreciation.js';

const router = Router();
const prisma = new PrismaClient();

router.use(authenticate);

const MOVEMENT_TYPE_LABELS: Record<string, string> = {
  CHECK_IN: 'Entrada',
  CHECK_OUT: 'Salida',
  TRANSFER: 'Traslado',
  STATUS_CHANGE: 'Cambio de estado',
};

const LOCATION_LABELS: Record<string, string> = {
  MAIN_AUDITORIUM: 'Auditorio principal',
  RECORDING_STUDIO: 'Estudio de grabación',
  STORAGE_ROOM: 'Cuarto de almacenamiento',
  YOUTH_ROOM: 'Salón de jóvenes',
  CHAPEL: 'Capilla',
  ON_LOAN: 'En préstamo',
};

const locLabel = (v?: string | null) => (v ? LOCATION_LABELS[v] ?? String(v).replace(/_/g, ' ') : '—');
const typeLabel = (v: string) => MOVEMENT_TYPE_LABELS[v] ?? v;

/** Construye un rango de fechas (createdAt) a partir de from/to (YYYY-MM-DD). */
function buildDateRange(from?: string, to?: string): { gte?: Date; lte?: Date } | undefined {
  const range: { gte?: Date; lte?: Date } = {};
  if (from) {
    const start = new Date(from);
    if (!isNaN(start.getTime())) range.gte = start;
  }
  if (to) {
    const end = new Date(to);
    if (!isNaN(end.getTime())) {
      end.setHours(23, 59, 59, 999);
      range.lte = end;
    }
  }
  return Object.keys(range).length ? range : undefined;
}

/** Filtros comunes para el reporte de movimientos. */
function buildMovementWhere(query: Record<string, unknown>) {
  const where: Record<string, unknown> = {};
  const from = query.from as string | undefined;
  const to = query.to as string | undefined;
  const type = query.type as string | undefined;
  const userId = query.userId as string | undefined;
  const deviceId = query.deviceId as string | undefined;
  const range = buildDateRange(from, to);
  if (range) where.createdAt = range;
  if (type) where.type = type;
  if (userId) where.userId = userId;
  if (deviceId) where.deviceId = deviceId;
  return where;
}

const fmtDateTime = (d: Date) =>
  new Date(d).toLocaleString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

// Historial de movimientos en Excel, con filtro por rango de fechas y tipo.
router.get('/movements/export', requirePermission('reports.export'), async (req, res, next) => {
  try {
    const where = buildMovementWhere(req.query as Record<string, unknown>);
    const movements = await prisma.movement.findMany({
      where,
      include: {
        device: { select: { internalCode: true, name: true, brand: true, model: true } },
        user: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const rows = movements.map((m) => ({
      Fecha: fmtDateTime(m.createdAt),
      Código: m.device?.internalCode ?? '',
      Equipo: m.device?.name ?? '',
      'Marca/Modelo': [m.device?.brand, m.device?.model].filter(Boolean).join(' '),
      Tipo: typeLabel(m.type),
      Desde: locLabel(m.fromLocation),
      Hacia: locLabel(m.toLocation),
      'Razón/Motivo': m.reason,
      'Realizado por': m.user?.name ?? '',
      'Correo': m.user?.email ?? '',
    }));

    const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ Fecha: '', Código: '', Equipo: '', 'Marca/Modelo': '', Tipo: '', Desde: '', Hacia: '', 'Razón/Motivo': '', 'Realizado por': '', 'Correo': '' }]);
    ws['!cols'] = [{ wch: 18 }, { wch: 12 }, { wch: 26 }, { wch: 24 }, { wch: 16 }, { wch: 20 }, { wch: 20 }, { wch: 30 }, { wch: 22 }, { wch: 26 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Movimientos');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=historial-movimientos-thewarehouse.xlsx');
    res.send(buf);
  } catch (e) {
    next(e);
  }
});

// Reporte informativo de movimientos en PDF, con filtro por rango de fechas.
router.get('/movements/pdf', requirePermission('reports.export'), async (req, res, next) => {
  try {
    const where = buildMovementWhere(req.query as Record<string, unknown>);
    const from = req.query.from as string | undefined;
    const to = req.query.to as string | undefined;
    const movements = await prisma.movement.findMany({
      where,
      include: {
        device: { select: { internalCode: true, name: true } },
        user: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const doc = new PDFDocument({ size: 'A4', margin: 40, layout: 'landscape' });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    const pdfPromise = new Promise<Buffer>((resolve, reject) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
    });

    doc.fontSize(18).fillColor('#1E3A5F').text('The Warehouse - Reporte de Movimientos', { align: 'center' });
    doc.moveDown(0.3);
    const rango = from || to ? `Periodo: ${from || '—'} a ${to || '—'}` : 'Periodo: todos los registros';
    doc.fontSize(10).fillColor('#666').text(rango, { align: 'center' });
    doc.fontSize(9).fillColor('#999').text(`Generado: ${new Date().toLocaleString('es-CO')}`, { align: 'center' });
    doc.moveDown(1.5);

    const colWidths = [95, 60, 130, 90, 90, 120, 110];
    const headers = ['Fecha', 'Código', 'Equipo', 'Tipo', 'Desde', 'Hacia', 'Realizado por'];
    const tableWidth = colWidths.reduce((a, b) => a + b, 0);
    let y = doc.y;

    const drawHeader = () => {
      doc.rect(40, y, tableWidth, 22).fill('#1E3A5F');
      doc.fillColor('#fff').fontSize(9);
      let x = 45;
      headers.forEach((h, i) => {
        doc.text(h, x, y + 6, { width: colWidths[i] - 6, align: 'left' });
        x += colWidths[i];
      });
      y += 24;
      doc.fillColor('#333');
    };

    drawHeader();
    movements.forEach((m, idx) => {
      if (y > 520) {
        doc.addPage();
        y = 40;
        drawHeader();
      }
      if (idx % 2 === 1) doc.rect(40, y, tableWidth, 18).fill('#f5f5f5');
      const row = [
        fmtDateTime(m.createdAt),
        m.device?.internalCode ?? '',
        m.device?.name ?? '',
        typeLabel(m.type),
        locLabel(m.fromLocation),
        locLabel(m.toLocation),
        m.user?.name ?? '',
      ];
      let x = 45;
      doc.fillColor('#333').fontSize(8);
      row.forEach((val, i) => {
        doc.text(String(val).slice(0, 40), x, y + 4, { width: colWidths[i] - 6 });
        x += colWidths[i];
      });
      y += 20;
    });

    doc.moveDown(2);
    doc.fontSize(10).fillColor('#666').text(`Total de movimientos: ${movements.length} | The Warehouse`, 40, doc.y, { align: 'center', width: tableWidth });

    doc.end();
    const pdf = await pdfPromise;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=reporte-movimientos-thewarehouse.pdf');
    res.send(pdf);
  } catch (e) {
    next(e);
  }
});

router.get('/inventory', requirePermission('reports.view'), async (req, res, next) => {
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

router.get('/inventory/pdf', requirePermission('reports.export'), async (req, res, next) => {
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

// Inventario completo en Excel.
router.get('/inventory/export', requirePermission('reports.export'), async (req: AuthRequest, res, next) => {
  try {
    const categoryId = req.query.categoryId as string | undefined;
    const where: Record<string, unknown> = { deletedAt: null };
    if (categoryId) where.categoryId = categoryId;
    const devices = await prisma.device.findMany({
      where,
      include: { category: { select: { name: true } } },
      orderBy: [{ category: { name: 'asc' } }, { internalCode: 'asc' }],
    });
    const perms = req.user?.permissions ?? [];
    const showCost = perms.includes('sensitive.view_cost');

    const rows = devices.map((d) => {
      const base: Record<string, unknown> = {
        Código: d.internalCode,
        Nombre: d.name,
        Marca: d.brand,
        Modelo: d.model,
        'Número de serie': d.serialNumber ?? '',
        Categoría: d.category?.name ?? '',
        Estado: d.status,
        Ubicación: locLabel(d.location),
        'Condición (%)': d.condition,
        Proveedor: d.supplier ?? '',
        Observación: d.observation ?? '',
      };
      if (showCost) base['Precio compra (COP)'] = d.purchasePrice != null ? Number(d.purchasePrice) : '';
      return base;
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Inventario');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=inventario-thewarehouse.xlsx');
    res.send(buf);
  } catch (e) {
    next(e);
  }
});

// Reporte de mantenimientos en Excel, con rango de fechas (por fecha de inicio).
router.get('/maintenance/export', requirePermission('reports.export'), async (req: AuthRequest, res, next) => {
  try {
    const where: Record<string, unknown> = {};
    const range = buildDateRange(req.query.from as string, req.query.to as string);
    if (range) where.startDate = range;
    if (req.query.status) where.status = req.query.status;
    const items = await prisma.maintenance.findMany({
      where,
      include: {
        device: { select: { internalCode: true, name: true } },
        user: { select: { name: true } },
      },
      orderBy: { startDate: 'desc' },
    });
    const perms = req.user?.permissions ?? [];
    const showCost = perms.includes('sensitive.view_cost');
    const rows = items.map((m) => {
      const base: Record<string, unknown> = {
        'Fecha inicio': m.startDate ? fmtDateTime(m.startDate) : '',
        'Fecha fin': m.endDate ? fmtDateTime(m.endDate) : '',
        Código: m.device?.internalCode ?? '',
        Equipo: m.device?.name ?? '',
        Tipo: m.type,
        Estado: m.status,
        Técnico: m.technician ?? '',
        Descripción: m.description,
        Notas: m.notes ?? '',
        'Registrado por': m.user?.name ?? '',
      };
      if (showCost) base['Costo'] = m.cost != null ? Number(m.cost) : '';
      return base;
    });
    const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ 'Fecha inicio': '', Código: '', Equipo: '' }]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Mantenimientos');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=mantenimientos-thewarehouse.xlsx');
    res.send(buf);
  } catch (e) {
    next(e);
  }
});

// Reporte de préstamos en Excel, con rango de fechas (por fecha de préstamo).
router.get('/loans/export', requirePermission('reports.export'), async (req, res, next) => {
  try {
    const where: Record<string, unknown> = {};
    const range = buildDateRange(req.query.from as string, req.query.to as string);
    if (range) where.loanDate = range;
    if (req.query.status) where.status = req.query.status;
    const items = await prisma.loanRecord.findMany({
      where,
      include: { device: { select: { internalCode: true, name: true } } },
      orderBy: { loanDate: 'desc' },
    });
    const rows = items.map((l) => ({
      Código: l.device?.internalCode ?? '',
      Equipo: l.device?.name ?? '',
      Prestatario: l.borrowerName,
      Correo: l.borrowerEmail ?? '',
      Teléfono: l.borrowerPhone ?? '',
      Propósito: l.purpose,
      'Fecha préstamo': l.loanDate ? fmtDateTime(l.loanDate) : '',
      'Devolución esperada': l.expectedReturn ? fmtDateTime(l.expectedReturn) : '',
      'Devolución real': l.returnDate ? fmtDateTime(l.returnDate) : '',
      Estado: l.status,
    }));
    const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ Código: '', Equipo: '', Prestatario: '' }]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Préstamos');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=prestamos-thewarehouse.xlsx');
    res.send(buf);
  } catch (e) {
    next(e);
  }
});

// Valoración financiera del inventario: precio de compra total vs valor en libros (depreciado), por categoría.
router.get('/financial', requirePermission('finance.view'), async (_req, res, next) => {
  try {
    const devices = await prisma.device.findMany({
      where: { deletedAt: null },
      select: {
        purchasePrice: true,
        purchaseDate: true,
        category: { select: { id: true, name: true, usefulLifeYears: true } },
      },
    });

    let totalPurchase = 0;
    let totalBookValue = 0;
    const byCategory: Record<string, { name: string; purchase: number; bookValue: number; count: number }> = {};

    for (const d of devices) {
      const price = d.purchasePrice != null ? Number(d.purchasePrice) : 0;
      const dep = computeDepreciation(
        d.purchasePrice != null ? Number(d.purchasePrice) : null,
        d.purchaseDate,
        d.category?.usefulLifeYears
      );
      const book = dep.bookValue ?? 0;
      totalPurchase += price;
      totalBookValue += book;
      const key = d.category?.id ?? 'none';
      const name = d.category?.name ?? 'Sin categoría';
      byCategory[key] = byCategory[key] || { name, purchase: 0, bookValue: 0, count: 0 };
      byCategory[key].purchase += price;
      byCategory[key].bookValue += book;
      byCategory[key].count += 1;
    }

    res.json({
      currency: 'COP',
      deviceCount: devices.length,
      totalPurchase: Math.round(totalPurchase * 100) / 100,
      totalBookValue: Math.round(totalBookValue * 100) / 100,
      totalDepreciation: Math.round((totalPurchase - totalBookValue) * 100) / 100,
      byCategory: Object.values(byCategory)
        .map((c) => ({ ...c, purchase: Math.round(c.purchase * 100) / 100, bookValue: Math.round(c.bookValue * 100) / 100 }))
        .sort((a, b) => b.purchase - a.purchase),
    });
  } catch (e) {
    next(e);
  }
});

export default router;
