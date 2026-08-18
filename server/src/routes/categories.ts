import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest, requirePermission } from '../middleware/auth.js';
import { createCategorySchema, updateCategorySchema } from '@soundvault/shared';
import { AppError } from '../middleware/errorHandler.js';
import { writeAudit } from '../lib/audit.js';

const router = Router();
const prisma = new PrismaClient();

const ACTIVE_DEVICE_COUNT = {
  select: { devices: { where: { deletedAt: null } } },
} as const;

router.use(authenticate);

router.get('/', async (req, res, next) => {
  try {
    const categories = await prisma.category.findMany({
      where: { parentId: null },
      include: {
        children: {
          include: {
            children: true,
            _count: ACTIVE_DEVICE_COUNT,
          },
        },
        _count: ACTIVE_DEVICE_COUNT,
      },
      orderBy: { name: 'asc' },
    });
    res.json(categories);
  } catch (e) {
    next(e);
  }
});

router.get('/tree', async (req, res, next) => {
  try {
    const categories = await prisma.category.findMany({
      include: { _count: ACTIVE_DEVICE_COUNT },
      orderBy: { name: 'asc' },
    });
    res.json(categories);
  } catch (e) {
    next(e);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const cat = await prisma.category.findUnique({
      where: { id: req.params.id },
      include: { parent: true, children: true, _count: ACTIVE_DEVICE_COUNT },
    });
    if (!cat) throw new AppError(404, 'Categoría no encontrada');
    res.json(cat);
  } catch (e) {
    next(e);
  }
});

router.post('/', requirePermission('categories.edit'), async (req: AuthRequest, res, next) => {
  try {
    const parsed = createCategorySchema.safeParse(req.body);
    if (!parsed.success) throw new AppError(400, parsed.error.errors[0]?.message || 'Datos inválidos');
    const category = await prisma.category.create({ data: parsed.data });
    await writeAudit(req, 'Category', category.id, 'CREATE', { name: category.name });
    res.status(201).json(category);
  } catch (e) {
    next(e);
  }
});

router.patch('/:id', requirePermission('categories.edit'), async (req: AuthRequest, res, next) => {
  try {
    const parsed = updateCategorySchema.safeParse(req.body);
    if (!parsed.success) throw new AppError(400, parsed.error.errors[0]?.message || 'Datos inválidos');
    const category = await prisma.category.update({
      where: { id: req.params.id },
      data: parsed.data,
    });
    await writeAudit(req, 'Category', category.id, 'UPDATE', parsed.data);
    res.json(category);
  } catch (e) {
    next(e);
  }
});

router.delete('/:id', requirePermission('categories.edit'), async (req: AuthRequest, res, next) => {
  try {
    const existing = await prisma.category.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new AppError(404, 'Categoría no encontrada');

    const childCount = await prisma.category.count({ where: { parentId: req.params.id } });
    if (childCount > 0) {
      throw new AppError(400, 'No se puede eliminar: tiene subcategorías. Elimínalas o muévelas primero.');
    }

    const activeDevices = await prisma.device.count({
      where: { categoryId: req.params.id, deletedAt: null },
    });
    if (activeDevices > 0) {
      throw new AppError(400, `No se puede eliminar: hay ${activeDevices} equipo(s) activo(s) en esta categoría.`);
    }

    await prisma.category.delete({ where: { id: req.params.id } });
    await writeAudit(req, 'Category', req.params.id, 'DELETE', { name: existing.name });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

export default router;
