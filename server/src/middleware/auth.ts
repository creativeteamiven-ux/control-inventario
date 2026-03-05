import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AppError } from './errorHandler.js';
import { getEffectivePermissions } from '../lib/permissions.js';

const JWT_SECRET = process.env.JWT_SECRET || 'soundvault-secret-change-in-production';

export interface JwtPayload {
  userId: string;
  email: string;
  role: string;
  permissions: string[];
}

export interface AuthRequest extends Request {
  user?: JwtPayload;
}

export function authenticate(
  req: AuthRequest,
  _res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return next(new AppError(401, 'No autorizado'));
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    req.user = decoded;
    next();
  } catch {
    next(new AppError(401, 'Token inválido o expirado'));
  }
}

export function requireRole(...roles: string[]) {
  return (req: AuthRequest, _res: Response, next: NextFunction) => {
    if (!req.user) return next(new AppError(401, 'No autorizado'));
    if (!roles.includes(req.user.role)) {
      return next(new AppError(403, 'Sin permisos para esta acción'));
    }
    next();
  };
}

export function requirePermission(...keys: string[]) {
  return (req: AuthRequest, _res: Response, next: NextFunction) => {
    if (!req.user) return next(new AppError(401, 'No autorizado'));
    const perms = req.user.permissions ?? [];
    const hasAll = keys.every((k) => perms.includes(k));
    if (!hasAll) return next(new AppError(403, 'Sin permisos para esta acción'));
    next();
  };
}
