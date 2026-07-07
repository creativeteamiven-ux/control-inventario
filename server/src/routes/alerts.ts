import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest, requireRole } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { computeAlerts } from '../lib/alerts.js';
import { sendMail, verifyMailer, isMailerConfigured, getAlertRecipients } from '../lib/mailer.js';
import { sendAlertDigest } from '../lib/notify.js';

const router = Router();
const prisma = new PrismaClient();

/**
 * Endpoint para CRON EXTERNO (Vercel Cron, cron-job.org, GitHub Actions, etc.).
 * No usa JWT: se autentica con un token secreto en la cabecera 'x-cron-secret'
 * (o query ?secret=). Definir ALERT_CRON_SECRET en el servidor para habilitarlo.
 * Va ANTES de authenticate para no requerir sesión de usuario.
 */
router.post('/cron/digest', async (req, res, next) => {
  try {
    const secret = process.env.ALERT_CRON_SECRET;
    if (!secret) throw new AppError(404, 'Cron no habilitado (falta ALERT_CRON_SECRET).');
    const provided = req.header('x-cron-secret') || (req.query.secret as string) || '';
    if (provided !== secret) throw new AppError(401, 'Token de cron inválido.');
    const onlyIfAny = process.env.ALERT_DIGEST_ALWAYS !== 'true';
    const result = await sendAlertDigest(prisma, { onlyIfAny });
    res.json({ ok: result.sent, ...result });
  } catch (e) {
    next(e);
  }
});

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
    // Envío manual: siempre manda (aunque no haya alertas) para confirmar que funciona.
    const result = await sendAlertDigest(prisma, { to: req.body?.to ? String(req.body.to) : undefined, onlyIfAny: false });
    if (!result.sent) throw new AppError(result.reason === 'no-recipients' ? 400 : 500, result.error || result.reason || 'No se pudo enviar');
    res.json({ ok: true, recipients: result.recipients, alertCount: result.alertCount });
  } catch (e) {
    next(e);
  }
});

export default router;
