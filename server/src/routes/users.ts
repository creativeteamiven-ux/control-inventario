import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { createUserSchema, updateUserSchema } from '@soundvault/shared';
import { AppError } from '../middleware/errorHandler.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { getEffectivePermissions, getDefaultPermissionsForRole, PERMISSIONS } from '../lib/permissions.js';

const router = Router();
const prisma = new PrismaClient();

router.use(authenticate);
router.use(requireRole('ADMIN'));

router.get('/permissions', (_req, res) => {
  res.json(PERMISSIONS);
});

router.get('/permission-defaults/:role', (req, res) => {
  const role = req.params.role?.toUpperCase();
  if (!role || !['ADMIN', 'MANAGER', 'TECHNICIAN', 'VIEWER'].includes(role)) {
    return res.status(400).json({ error: 'Rol inválido' });
  }
  res.json(getDefaultPermissionsForRole(role));
});

router.get('/', async (req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true, permissions: true, avatar: true, phone: true, createdAt: true },
      orderBy: { name: 'asc' },
    });
    res.json(users);
  } catch (e) {
    next(e);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: { id: true, name: true, email: true, role: true, permissions: true, avatar: true, phone: true, createdAt: true },
    });
    if (!user) throw new AppError(404, 'Usuario no encontrado');
    res.json(user);
  } catch (e) {
    next(e);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const parsed = createUserSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError(400, parsed.error.errors[0]?.message || 'Datos inválidos');
    const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
    if (existing) throw new AppError(400, 'El email ya está registrado');
    const hashedPassword = await bcrypt.hash(parsed.data.password, 10);
    const permissions = parsed.data.permissions ?? getEffectivePermissions(parsed.data.role, null);
    const user = await prisma.user.create({
      data: {
        name: parsed.data.name,
        email: parsed.data.email,
        password: hashedPassword,
        role: parsed.data.role,
        permissions,
        phone: parsed.data.phone,
      },
      select: { id: true, name: true, email: true, role: true, permissions: true },
    });
    res.status(201).json(user);
  } catch (e) {
    next(e);
  }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const parsed = updateUserSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError(400, parsed.error.errors[0]?.message || 'Datos inválidos');
    const update: Record<string, unknown> = { ...parsed.data };
    if (parsed.data.password) {
      update.password = await bcrypt.hash(parsed.data.password, 10);
    }
    if (parsed.data.permissions !== undefined) {
      update.permissions = parsed.data.permissions;
    }
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: update as Parameters<typeof prisma.user.update>[0]['data'],
      select: { id: true, name: true, email: true, role: true, permissions: true },
    });
    res.json(user);
  } catch (e) {
    next(e);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await prisma.user.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (e) {
    next(e);
  }
});

export default router;
