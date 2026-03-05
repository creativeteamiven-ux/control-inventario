import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { loginSchema } from '@soundvault/shared';
import { AppError } from '../middleware/errorHandler.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { getEffectivePermissions } from '../lib/permissions.js';

const router = Router();
const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'soundvault-secret-change-in-production';
const REFRESH_SECRET = process.env.REFRESH_SECRET || 'soundvault-refresh-secret';
const ACCESS_EXPIRY = '15m';
const REFRESH_EXPIRY = '7d';

function buildPayload(user: { id: string; email: string; role: string; permissions: unknown }) {
  const permissions = getEffectivePermissions(user.role, user.permissions);
  return { userId: user.id, email: user.email, role: user.role, permissions };
}

router.post('/login', async (req, res, next) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, parsed.error.errors[0]?.message || 'Datos inválidos');
    }
    const { email, password } = parsed.data;
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, name: true, email: true, role: true, avatar: true, password: true, permissions: true },
    });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      throw new AppError(401, 'Credenciales incorrectas');
    }
    const payload = buildPayload(user);
    const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_EXPIRY });
    const refreshToken = jwt.sign({ ...payload, type: 'refresh' }, REFRESH_SECRET, { expiresIn: REFRESH_EXPIRY });
    res.json({
      accessToken,
      refreshToken,
      expiresIn: 900,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
        permissions: payload.permissions,
      },
    });
  } catch (e) {
    next(e);
  }
});

router.post('/refresh', async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) throw new AppError(400, 'Refresh token requerido');
    const decoded = jwt.verify(refreshToken, REFRESH_SECRET) as { userId: string; email: string; role: string };
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, email: true, role: true, permissions: true },
    });
    if (!user) throw new AppError(401, 'Usuario no encontrado');
    const payload = buildPayload(user);
    const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_EXPIRY });
    res.json({ accessToken, expiresIn: 900 });
  } catch (e) {
    next(e);
  }
});

router.get('/me', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { id: true, name: true, email: true, role: true, avatar: true, permissions: true },
    });
    if (!user) return next(new AppError(401, 'Usuario no encontrado'));
    const permissions = getEffectivePermissions(user.role, user.permissions);
    res.json({ ...user, permissions });
  } catch (e) {
    next(e);
  }
});

router.post('/logout', authenticate, async (_req: AuthRequest, res) => {
  res.json({ success: true });
});

export default router;
