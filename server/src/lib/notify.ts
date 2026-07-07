/**
 * Lógica central de notificaciones por correo.
 * Reutilizada por: endpoint manual (/alerts/send-digest), scheduler interno (node-cron)
 * y endpoint para cron externo (/alerts/cron/digest).
 */
import { PrismaClient } from '@prisma/client';
import { computeAlerts, alertsToHtml } from './alerts.js';
import { sendMail, getAlertRecipients, isMailerConfigured } from './mailer.js';

export interface DigestResult {
  sent: boolean;
  skipped?: boolean;
  reason?: string;
  recipients?: string[];
  alertCount?: number;
  error?: string;
}

/** Resuelve destinatarios: override → ALERT_RECIPIENTS → todos los administradores. */
export async function resolveRecipients(prisma: PrismaClient, override?: string): Promise<string[]> {
  if (override) return [override];
  const configured = getAlertRecipients();
  if (configured.length > 0) return configured;
  const admins = await prisma.user.findMany({ where: { role: 'ADMIN' }, select: { email: true } });
  return admins.map((a) => a.email).filter(Boolean);
}

/**
 * Calcula las alertas y envía el resumen por correo.
 * @param opts.to        destinatario único (opcional, para pruebas)
 * @param opts.onlyIfAny si es true, no envía cuando no hay alertas (evita spam)
 */
export async function sendAlertDigest(
  prisma: PrismaClient,
  opts?: { to?: string; onlyIfAny?: boolean }
): Promise<DigestResult> {
  if (!isMailerConfigured()) return { sent: false, skipped: true, reason: 'mailer-not-configured' };

  const recipients = await resolveRecipients(prisma, opts?.to);
  if (recipients.length === 0) return { sent: false, skipped: true, reason: 'no-recipients' };

  const alerts = await computeAlerts(prisma);
  if (opts?.onlyIfAny && alerts.length === 0) {
    return { sent: false, skipped: true, reason: 'no-alerts', alertCount: 0, recipients };
  }

  const result = await sendMail({
    to: recipients,
    subject: `The Warehouse — ${alerts.length} alerta(s) pendiente(s)`,
    html: alertsToHtml(alerts),
  });

  return { sent: result.sent, error: result.error, recipients, alertCount: alerts.length };
}
