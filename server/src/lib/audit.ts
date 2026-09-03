/**
 * Registro de auditoría: guarda quién hizo qué y cuándo en la entidad AuditLog.
 * Nunca debe romper la operación principal: si falla, solo se loguea.
 */
import { prisma } from './prisma.js';
import type { AuthRequest } from '../middleware/auth.js';


export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'RETURN' | 'STATUS_CHANGE';

export async function writeAudit(
  req: AuthRequest,
  entity: string,
  entityId: string,
  action: AuditAction,
  changes?: unknown
): Promise<void> {
  try {
    const forwarded = req.headers['x-forwarded-for'];
    const ip = (Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(',')[0]?.trim()) || req.ip || null;
    await prisma.auditLog.create({
      data: {
        entity,
        entityId,
        action,
        changes: (changes ?? undefined) as object | undefined,
        userId: req.user?.userId ?? null,
        userEmail: req.user?.email ?? null,
        ipAddress: ip,
        userAgent: (req.headers['user-agent'] as string) ?? null,
      },
    });
  } catch (e) {
    console.error('[Audit] No se pudo registrar:', (e as Error).message);
  }
}
