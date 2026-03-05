import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, requireRole } from '../middleware/auth.js';
import { createCategorySchema, updateCategorySchema } from '@soundvault/shared';
import { AppError } from '../middleware/errorHandler.js';

const router = Router();
const prisma = new PrismaClient();

router.use(authenticate);

router.get('/', async (req, res, next) => {
  try {
    const categories = await prisma.category.findMany({
      where: { parentId: null },
      include: {
        children: {
          include: {
            children: true,
            _count: { select: { devices: true } },
          },
        },
        _count: { select: { devices: true } },
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
      include: { _count: { select: { devices: true } } },
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
      include: { parent: true, children: true, _count: { select: { devices: true } } },
    });
    if (!cat) throw new AppError(404, 'Categoría no encontrada');
    res.json(cat);
  } catch (e) {
    next(e);
  }
});

router.post('/', requireRole('ADMIN', 'MANAGER'), async (req, res, next) => {
  try {
    const parsed = createCategorySchema.safeParse(req.body);
    if (!parsed.success) throw new AppError(400, parsed.error.errors[0]?.message || 'Datos inválidos');
    const category = await prisma.category.create({ data: parsed.data });
    res.status(201).json(category);
  } catch (e) {
    next(e);
  }
});

router.patch('/:id', requireRole('ADMIN', 'MANAGER'), async (req, res, next) => {
  try {
    const parsed = updateCategorySchema.safeParse(req.body);
    if (!parsed.success) throw new AppError(400, parsed.error.errors[0]?.message || 'Datos inválidos');
    const category = await prisma.category.update({
      where: { id: req.params.id },
      data: parsed.data,
    });
    res.json(category);
  } catch (e) {
    next(e);
  }
});

router.delete('/:id', requireRole('ADMIN'), async (req, res, next) => {
  try {
    await prisma.category.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (e) {
    next(e);
  }
});

export default router;
