import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest, requireRole } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { computeAlerts, alertsToHtml } from '../lib/alerts.js';
import { sendMail, verifyMailer, isMailerConfigured, getAlertRecipients } from '../lib/mailer.js';

const router = Router();
const prisma = new PrismaClient();

router.use(authenticate);

/** Alertas actuales (para la campanita y el panel). Cualquier usuario autenticado. */
router.get('/', async (_req, res, next) => {
  try {
    const alerts = await computeAlerts(prisma);
    res.json({
      count: alerts.length,
      bySeverity: {
        critical: alerts.filter((a) => a.severity === 'critical').length,
        warning: alerts.filter((a) => a.severity === 'warning').length,
        info: alerts.filter((a) => a.severity === 'info').length,
      },
      alerts,
    });
  } catch (e) {
    next(e);
  }
});

/** Estado de la configuración de correo (solo ADMIN). */
router.get('/mail-status', requireRole('ADMIN'), async (_req, res, next) => {
  try {
    const configured = isMailerConfigured();
    const verify = configured ? await verifyMailer() : { ok: false, error: 'No configurado' };
    res.json({ configured, verified: verify.ok, error: verify.error, recipients: getAlertRecipients() });
  } catch (e) {
    next(e);
  }
});

/** Enviar un correo de prueba (solo ADMIN). */
router.post('/test', requireRole('ADMIN'), async (req: AuthRequest, res, next) => {
  try {
    if (!isMailerConfigured()) throw new AppError(400, 'El correo no está configurado. Define GMAIL_USER/GMAIL_APP_PASSWORD o SMTP_* en el servidor.');
    const to = (req.body?.to as string) || req.user?.email;
    if (!to) throw new AppError(400, 'No hay destinatario');
    const result = await sendMail({
      to,
      subject: 'Correo de prueba — The Warehouse',
      html: '<p>✅ La configuración de correo funciona correctamente.</p>',
    });
    if (!result.sent) throw new AppError(500, result.error || 'No se pudo enviar');
    res.json({ ok: true, to });
  } catch (e) {
    next(e);
  }
});

/** Calcular alertas y enviarlas por correo a los destinatarios configurados (solo ADMIN). */
router.post('/send-digest', requireRole('ADMIN'), async (req: AuthRequest, res, next) => {
  try {
    if (!isMailerConfigured()) throw new AppError(400, 'El correo no está configurado.');
    let recipients = getAlertRecipients();
    if (recipients.length === 0) {
      const admins = await prisma.user.findMany({ where: { role: 'ADMIN' }, select: { email: true } });
      recipients = admins.map((a) => a.email);
    }
    if (req.body?.to) recipients = [String(req.body.to)];
    if (recipients.length === 0) throw new AppError(400, 'No hay destinatarios');
    const alerts = await computeAlerts(prisma);
    const result = await sendMail({
      to: recipients,
      subject: `The Warehouse — ${alerts.length} alerta(s) pendiente(s)`,
      html: alertsToHtml(alerts),
    });
    if (!result.sent) throw new AppError(500, result.error || 'No se pudo enviar');
    res.json({ ok: true, recipients, alertCount: alerts.length });
  } catch (e) {
    next(e);
  }
});

export default router;
