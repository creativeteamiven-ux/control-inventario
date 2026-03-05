/**
 * Rutas para descargar plantillas Excel
 */
import { Router } from 'express';
import * as XLSX from 'xlsx';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/auth.js';

const router = Router();
const prisma = new PrismaClient();
router.use(authenticate);

// Plantilla para agregar equipos
router.get('/equipment', (_req, res, next) => {
  try {
    const headers = [
      'Nombre', 'Marca', 'Modelo', 'Serie', 'Categoria_Slug', 'Estado', 'Ubicacion', 'Precio', 'Proveedor', 'Notas', 'Observacion', 'Condicion',
    ];
    const examples = [
      ['Behringer X32', 'Behringer', 'X32', 'BHR-001', 'consolas', 'ACTIVE', 'MAIN_AUDITORIUM', 2499, 'ProAudio Chile', 'Consola principal', 'Enviar a mantenimiento', 100],
      ['Shure SM58', 'Shure', 'SM58', 'SH-002', 'microfonos', 'ACTIVE', 'STORAGE_ROOM', 99, '', '', '', 95],
    ];
    const data = [headers, ...examples];
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = [{ wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 12 }, { wch: 15 }, { wch: 12 }, { wch: 18 }, { wch: 10 }, { wch: 15 }, { wch: 25 }, { wch: 28 }, { wch: 10 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Equipos');
    const ayuda = XLSX.utils.aoa_to_sheet([
      ['Categoria_Slug', 'consolas, parlantes, amplificadores, microfonos, interfaces, monitores-estudio, guitarras-bajos, teclados, bateria, cables-accessories, lighting, multimedia'],
      ['Estado', 'ACTIVE, MAINTENANCE, DAMAGED, LOST, RETIRED, LOANED'],
      ['Ubicacion', 'MAIN_AUDITORIUM, RECORDING_STUDIO, STORAGE_ROOM, YOUTH_ROOM, CHAPEL, ON_LOAN'],
      ['Observacion', 'Opcional. Ej: enviar a mantenimiento, cable dañado. Equipos operativos con novedad.'],
    ]);
    XLSX.utils.book_append_sheet(wb, ayuda, 'Valores validos');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Disposition', 'attachment; filename=plantilla-equipos-soundvault.xlsx');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buf);
  } catch (e) {
    next(e);
  }
});

// Plantilla para traslados/movimientos
// Query: ?deviceIds=id1,id2,... — prellena filas con esos equipos (del carrito)
router.get('/transfers', async (req, res, next) => {
  try {
    const headers = ['Codigo_Equipo', 'Nombre', 'Desde_Ubicacion', 'Tipo', 'Hasta_Ubicacion', 'Razon', 'Responsable', 'Fecha'];
    let rows: (string | number)[][] = [];

    const deviceIdsParam = req.query.deviceIds;
    if (deviceIdsParam && typeof deviceIdsParam === 'string') {
      const ids = deviceIdsParam.split(',').map((s) => s.trim()).filter(Boolean);
      if (ids.length > 0) {
        const devices = await prisma.device.findMany({
          where: { id: { in: ids }, deletedAt: null },
          select: { internalCode: true, name: true, location: true },
        });
        rows = devices.map((d) => [
          d.internalCode,
          d.name,
          d.location,
          '', // Tipo — usuario completa
          '', // Hasta_Ubicacion
          '', // Razon
          '', // Responsable
          '', // Fecha
        ]);
      }
    }

    if (rows.length === 0) {
      rows = [
        ['PA-001', 'Consola Behringer X32', 'STORAGE_ROOM', 'TRANSFER', 'MAIN_AUDITORIUM', 'Servicio dominical', 'admin@soundvault.com', '2025-02-27'],
        ['REC-006', 'Interface Focusrite', 'STORAGE_ROOM', 'CHECK_OUT', 'RECORDING_STUDIO', 'Sesión de grabación', 'tecnico@soundvault.com', '2025-02-27'],
      ];
    }

    const data = [headers, ...rows];
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = [{ wch: 12 }, { wch: 25 }, { wch: 18 }, { wch: 15 }, { wch: 18 }, { wch: 30 }, { wch: 25 }, { wch: 12 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Traslados');
    const ayuda = XLSX.utils.aoa_to_sheet([
      ['Tipo', 'CHECK_IN, CHECK_OUT, TRANSFER, STATUS_CHANGE'],
      ['Ubicaciones', 'MAIN_AUDITORIUM, RECORDING_STUDIO, STORAGE_ROOM, YOUTH_ROOM, CHAPEL, ON_LOAN'],
      ['Responsable', 'Email del usuario. Si está vacío, usa el usuario que importa.'],
      ['Fecha', 'YYYY-MM-DD. Si está vacío, usa la fecha actual.'],
    ]);
    XLSX.utils.book_append_sheet(wb, ayuda, 'Valores validos');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Disposition', 'attachment; filename=plantilla-traslados-soundvault.xlsx');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buf);
  } catch (e) {
    next(e);
  }
});

// Plantilla para enviar equipos a mantenimiento (cambiar estado y crear registro)
// Query: ?deviceIds=id1,id2,... — opcional, prellena filas con esos equipos
router.get('/maintenance', async (req, res, next) => {
  try {
    const headers = ['Codigo_Equipo', 'Nombre', 'Descripcion', 'Tipo', 'Fecha_inicio'];
    let rows: (string | number)[][] = [];

    const deviceIdsParam = req.query.deviceIds;
    if (deviceIdsParam && typeof deviceIdsParam === 'string') {
      const ids = deviceIdsParam.split(',').map((s) => s.trim()).filter(Boolean);
      if (ids.length > 0) {
        const devices = await prisma.device.findMany({
          where: { id: { in: ids }, deletedAt: null },
          select: { internalCode: true, name: true },
        });
        const today = new Date().toISOString().slice(0, 10);
        rows = devices.map((d) => [
          d.internalCode,
          d.name,
          '', // Descripcion — usuario completa (ej: Revisión preventiva)
          'preventivo',
          today,
        ]);
      }
    }

    if (rows.length === 0) {
      rows = [
        ['PA-001', 'Consola Behringer X32', 'Revisión preventiva', 'preventivo', new Date().toISOString().slice(0, 10)],
        ['MIC-002', 'Shure SM58', 'Cambio de cable', 'correctivo', new Date().toISOString().slice(0, 10)],
      ];
    }

    const data = [headers, ...rows];
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = [{ wch: 12 }, { wch: 28 }, { wch: 30 }, { wch: 14 }, { wch: 12 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Mantenimiento');
    const ayuda = XLSX.utils.aoa_to_sheet([
      ['Codigo_Equipo', 'Código interno del equipo (obligatorio). Debe existir en el inventario.'],
      ['Descripcion', 'Obligatorio. Motivo o descripción del mantenimiento.'],
      ['Tipo', 'Opcional: preventivo, correctivo, calibración. Por defecto: preventivo.'],
      ['Fecha_inicio', 'Opcional. YYYY-MM-DD. Si está vacío, se usa la fecha actual.'],
    ]);
    XLSX.utils.book_append_sheet(wb, ayuda, 'Valores validos');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Disposition', 'attachment; filename=plantilla-mantenimiento-soundvault.xlsx');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buf);
  } catch (e) {
    next(e);
  }
});

// Reporte/plantilla con equipos en mantenimiento para completar datos y cargar de forma masiva
// Incluye registros con estado SCHEDULED o IN_PROGRESS (sin completar)
router.get('/maintenance-report', async (_req, res, next) => {
  try {
    const records = await prisma.maintenance.findMany({
      where: { status: { in: ['SCHEDULED', 'IN_PROGRESS'] } },
      include: { device: { select: { internalCode: true, name: true } } },
      orderBy: { startDate: 'desc' },
    });
    const headers = [
      'Id_Mantenimiento',
      'Codigo_Equipo',
      'Nombre',
      'Tipo',
      'Descripcion',
      'Fecha_inicio',
      'Estado',
      'Costo',
      'Tecnico',
      'Fecha_fin',
      'Notas',
    ];
    const rows = records.map((m) => [
      m.id,
      m.device?.internalCode ?? '',
      m.device?.name ?? '',
      m.type,
      m.description,
      m.startDate ? new Date(m.startDate).toISOString().slice(0, 10) : '',
      m.status,
      m.cost != null ? Number(m.cost) : '',
      m.technician ?? '',
      m.endDate ? new Date(m.endDate).toISOString().slice(0, 10) : '',
      m.notes ?? '',
    ]);
    const data = [headers, ...rows];
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = [
      { wch: 26 },
      { wch: 14 },
      { wch: 28 },
      { wch: 12 },
      { wch: 35 },
      { wch: 12 },
      { wch: 14 },
      { wch: 10 },
      { wch: 20 },
      { wch: 12 },
      { wch: 25 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Datos mantenimiento');
    const ayuda = XLSX.utils.aoa_to_sheet([
      ['Id_Mantenimiento', 'No modificar. Identificador único del registro (obligatorio para cargar).'],
      ['Estado', 'SCHEDULED, IN_PROGRESS o COMPLETED. Al poner COMPLETED puede indicar Fecha_fin.'],
      ['Costo', 'Número. Ej: 150000'],
      ['Tecnico', 'Nombre del técnico que realizó o realizará el mantenimiento.'],
      ['Fecha_fin', 'YYYY-MM-DD. Fecha de finalización. Si Estado=COMPLETED y vacío, se usa hoy.'],
    ]);
    XLSX.utils.book_append_sheet(wb, ayuda, 'Valores validos');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Disposition', 'attachment; filename=reporte-mantenimiento-datos.xlsx');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buf);
  } catch (e) {
    next(e);
  }
});

export default router;
