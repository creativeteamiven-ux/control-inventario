import { prisma } from '../lib/prisma.js';
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { createUserSchema, updateUserSchema } from '@soundvault/shared';
import { AppError } from '../middleware/errorHandler.js';
import { authenticate, AuthRequest, requirePermission } from '../middleware/auth.js';
import { getEffectivePermissions, getDefaultPermissionsForRole, PERMISSIONS } from '../lib/permissions.js';
import { writeAudit } from '../lib/audit.js';

const router = Router();

router.use(authenticate);

router.get('/permissions', requirePermission('users.view'), (_req, res) => {
  res.json(PERMISSIONS);
});

router.get('/permission-defaults/:role', requirePermission('users.view'), (req, res) => {
  const role = req.params.role?.toUpperCase();
  if (!role || !['ADMIN', 'MANAGER', 'TECHNICIAN', 'VIEWER'].includes(role)) {
    return res.status(400).json({ error: 'Rol inválido' });
  }
  res.json(getDefaultPermissionsForRole(role));
});

/** Lista ligera para filtros (reportes, etc.) — no expone email ni permisos. */
router.get('/names', requirePermission('reports.export'), async (_req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
    res.json(users);
  } catch (e) {
    next(e);
  }
});

router.get('/', requirePermission('users.view'), async (_req, res, next) => {
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

router.get('/:id', requirePermission('users.view'), async (req, res, next) => {
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

router.post('/', requirePermission('users.create'), async (req: AuthRequest, res, next) => {
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
    await writeAudit(req, 'User', user.id, 'CREATE', { email: user.email, role: user.role });
    res.status(201).json(user);
  } catch (e) {
    next(e);
  }
});

router.patch('/:id', requirePermission('users.edit'), async (req: AuthRequest, res, next) => {
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
    await writeAudit(req, 'User', user.id, 'UPDATE', { role: parsed.data.role });
    res.json(user);
  } catch (e) {
    next(e);
  }
});

router.delete('/:id', requirePermission('users.delete'), async (req: AuthRequest, res, next) => {
  try {
    const id = req.params.id;
    if (id === req.user?.userId) {
      throw new AppError(400, 'No puedes eliminar tu propio usuario');
    }
    const existing = await prisma.user.findUnique({ where: { id }, select: { id: true, email: true, name: true } });
    if (!existing) throw new AppError(404, 'Usuario no encontrado');

    const reassignTo = req.user!.userId;
    await prisma.$transaction(async (tx) => {
      await tx.movement.updateMany({ where: { userId: id }, data: { userId: reassignTo } });
      await tx.maintenance.updateMany({ where: { userId: id }, data: { userId: reassignTo } });
      await tx.loanRecord.updateMany({ where: { approvedBy: id }, data: { approvedBy: reassignTo } });
      await tx.user.delete({ where: { id } });
    });
    await writeAudit(req, 'User', id, 'DELETE', {
      email: existing.email,
      name: existing.name,
      reassignedTo: reassignTo,
    });
    res.status(204).send();
  } catch (e) {
    next(e);
  }
});

export default router;
