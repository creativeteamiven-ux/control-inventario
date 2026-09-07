import { Request, Response, NextFunction } from 'express';
import { setCorsIfAllowed } from '../lib/cors.js';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public isOperational = true
  ) {
    super(message);
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export function errorHandler(
  err: Error | AppError,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  setCorsIfAllowed(res, req.headers.origin);
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ error: err.message });
  }
  console.error('[Error 500]', err.message);
  console.error(err.stack);
  const prismaCode = (err as { code?: string }).code;
  if (prismaCode === 'P2021' || prismaCode === 'P2022') {
    return res.status(503).json({
      error: 'Faltan tablas en la base de datos. Espera unos minutos al reinicio del servidor o contacta al administrador.',
    });
  }
  const message = process.env.NODE_ENV !== 'production' ? err.message : 'Error interno del servidor';
  res.status(500).json({ error: message });
}
