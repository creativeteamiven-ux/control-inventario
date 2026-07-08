/**
 * Destinatarios de alertas: prioridad base de datos → variable ALERT_RECIPIENTS → admins.
 */
import type { PrismaClient } from '@prisma/client';
import { getAlertRecipients as getEnvRecipients } from './mailer.js';

export type RecipientSource = 'database' | 'env' | 'admins' | 'none';

/** Lista activa en la base de datos. */
export async function getDbAlertRecipients(prisma: PrismaClient) {
  try {
    return await prisma.alertRecipient.findMany({
      orderBy: [{ active: 'desc' }, { createdAt: 'asc' }],
    });
  } catch (e) {
    console.warn('[AlertRecipients] No se pudo leer la tabla:', (e as Error).message);
    return [];
  }
}

/** Correos efectivos que recibirán alertas (solo activos en BD, o respaldo env/admins). */
export async function getEffectiveAlertEmails(prisma: PrismaClient): Promise<{
  emails: string[];
  source: RecipientSource;
}> {
  try {
    const active = await prisma.alertRecipient.findMany({
      where: { active: true },
      select: { email: true },
      orderBy: { createdAt: 'asc' },
    });
    if (active.length > 0) {
      return { emails: active.map((r) => r.email), source: 'database' };
    }
  } catch (e) {
    console.warn('[AlertRecipients] Tabla no disponible, usando respaldo:', (e as Error).message);
  }
  const env = getEnvRecipients();
  if (env.length > 0) return { emails: env, source: 'env' };
  const admins = await prisma.user.findMany({
    where: { role: 'ADMIN' },
    select: { email: true },
  });
  const adminEmails = admins.map((a) => a.email).filter(Boolean);
  if (adminEmails.length > 0) return { emails: adminEmails, source: 'admins' };
  return { emails: [], source: 'none' };
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}
