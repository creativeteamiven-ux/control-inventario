import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, requireRole } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Router();
const prisma = new PrismaClient();

const DEFAULT_LOCATIONS = [
  { code: 'MAIN_AUDITORIUM', name: 'Auditorio principal', sortOrder: 1 },
  { code: 'RECORDING_STUDIO', name: 'Estudio de grabación', sortOrder: 2 },
  { code: 'STORAGE_ROOM', name: 'Cuarto de almacenamiento', sortOrder: 3 },
  { code: 'YOUTH_ROOM', name: 'Salón de jóvenes', sortOrder: 4 },
  { code: 'CHAPEL', name: 'Capilla', sortOrder: 5 },
  { code: 'ON_LOAN', name: 'En préstamo', sortOrder: 6 },
];

router.use(authenticate);

/** Listar todos los lugares (para dropdowns y módulo Lugares). Si no hay ninguno, crea los por defecto. */
router.get('/', async (_req, res, next) => {
  try {
    let list = await prisma.location.findMany({ orderBy: { sortOrder: 'asc' } });
    if (list.length === 0) {
      for (const loc of DEFAULT_LOCATIONS) {
        await prisma.location.create({ data: loc });
      }
      list = await prisma.location.findMany({ orderBy: { sortOrder: 'asc' } });
    }
    res.json(list);
  } catch (e) {
    next(e);
  }
});

/** Crear un nuevo lugar (solo ADMIN/MANAGER). code se genera del nombre si no se envía. */
router.post('/', requireRole('ADMIN', 'MANAGER'), async (req, res, next) => {
  try {
    const body = req.body as { name: string; code?: string; sortOrder?: number };
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) throw new AppError(400, 'El nombre es obligatorio');
    const code = typeof body.code === 'string' && body.code.trim()
      ? body.code.trim().toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, '')
      : name.toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_ÁÉÍÓÚÑ]/gi, '').normalize('NFD').replace(/\u0300/g, '');
    if (!code) throw new AppError(400, 'No se pudo generar un código válido desde el nombre');
    const sortOrder = typeof body.sortOrder === 'number' ? body.sortOrder : (await prisma.location.count());
    const existing = await prisma.location.findUnique({ where: { code } });
    if (existing) throw new AppError(400, `Ya existe un lugar con el código "${code}". Usa otro nombre o código.`);
    const location = await prisma.location.create({
      data: { code, name, sortOrder },
    });
    res.status(201).json(location);
  } catch (e) {
    next(e);
  }
});

/** Actualizar nombre y/o orden de un lugar (solo ADMIN/MANAGER) */
router.patch('/:id', requireRole('ADMIN', 'MANAGER'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const body = req.body as { name?: string; sortOrder?: number };
    const update: { name?: string; sortOrder?: number } = {};
    if (typeof body.name === 'string' && body.name.trim()) update.name = body.name.trim();
    if (typeof body.sortOrder === 'number') update.sortOrder = body.sortOrder;
    if (Object.keys(update).length === 0) throw new AppError(400, 'Indica name y/o sortOrder');
    const location = await prisma.location.update({
      where: { id },
      data: update,
    });
    res.json(location);
  } catch (e) {
    next(e);
  }
});

export default router;
