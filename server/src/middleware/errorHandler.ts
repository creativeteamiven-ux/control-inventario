import { Request, Response, NextFunction } from 'express';

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

const PRODUCTION_DOMAIN = 'https://thewarehouse.diosfuentedepoder.com';

function setCorsIfAllowed(res: Response, origin: string | undefined) {
  if (!origin) return;
  const allowed =
    origin === 'http://localhost:5173' ||
    origin === PRODUCTION_DOMAIN ||
    (origin.startsWith('https://') && origin.includes('control-inventario-02') && origin.endsWith('.vercel.app'));
  if (allowed) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
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
  const message = process.env.NODE_ENV !== 'production' ? err.message : 'Error interno del servidor';
  res.status(500).json({ error: message });
}
