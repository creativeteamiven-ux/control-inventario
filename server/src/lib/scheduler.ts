/**
 * Scheduler interno de notificaciones (para entornos always-on: local y Render).
 * Envía el resumen de alertas por correo según una expresión cron.
 *
 * Variables de entorno:
 *  - ALERT_DIGEST_CRON  Expresión cron (por defecto "0 8 * * *" = 8:00 a. m. cada día)
 *  - ALERT_DIGEST_TZ    Zona horaria (por defecto "America/Bogota")
 *  - ALERT_DIGEST_ALWAYS  "true" para enviar aunque no haya alertas (por defecto solo si hay)
 *
 * En serverless (Vercel) esto no aplica: usar un cron externo que llame a
 * POST /api/alerts/cron/digest con la cabecera x-cron-secret.
 */
import cron from 'node-cron';
import type { ScheduledTask } from 'node-cron';
import { PrismaClient } from '@prisma/client';
import { isMailerConfigured } from './mailer.js';
import { sendAlertDigest } from './notify.js';

let task: ScheduledTask | null = null;

export function startAlertScheduler(prisma: PrismaClient): void {
  const expr = process.env.ALERT_DIGEST_CRON || '0 8 * * *';
  const timezone = process.env.ALERT_DIGEST_TZ || 'America/Bogota';

  if (!cron.validate(expr)) {
    console.warn(`[Scheduler] ALERT_DIGEST_CRON inválido ("${expr}"). No se programó el resumen.`);
    return;
  }

  if (task) task.stop();

  task = cron.schedule(
    expr,
    async () => {
      if (!isMailerConfigured()) return;
      try {
        const onlyIfAny = process.env.ALERT_DIGEST_ALWAYS !== 'true';
        const result = await sendAlertDigest(prisma, { onlyIfAny });
        if (result.sent) {
          console.log(`[Scheduler] Resumen enviado a ${result.recipients?.length} destinatario(s) (${result.alertCount} alertas).`);
        } else {
          console.log(`[Scheduler] Resumen no enviado: ${result.reason || result.error}`);
        }
      } catch (e) {
        console.error('[Scheduler] Error al enviar el resumen:', (e as Error).message);
      }
    },
    { timezone }
  );

  const mailerNote = isMailerConfigured() ? '' : ' (correo aún NO configurado; no enviará hasta definir GMAIL_USER/GMAIL_APP_PASSWORD)';
  console.log(`[Scheduler] Resumen de alertas programado: "${expr}" zona ${timezone}${mailerNote}`);
}
