import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest, requireRole } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { computeAlerts } from '../lib/alerts.js';
import { sendMail, verifyMailer, isMailerConfigured, getAlertRecipients, getMailProvider, formatMailError } from '../lib/mailer.js';
import { sendAlertDigest } from '../lib/notify.js';
import { getDbAlertRecipients, getEffectiveAlertEmails, isValidEmail } from '../lib/alertRecipients.js';
import { writeAudit } from '../lib/audit.js';

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

/** Estado de la configuración de correo (solo ADMIN). verify=1 comprueba SMTP (lento). */
router.get('/mail-status', requireRole('ADMIN'), async (req, res, next) => {
  try {
    const configured = isMailerConfigured();
    const shouldVerify = req.query.verify === 'true' || req.query.verify === '1';
    let verified: boolean | null = null;
    let error: string | undefined;
    let hint: string | undefined;
    if (configured && shouldVerify) {
      const verify = await verifyMailer();
      verified = verify.ok;
      error = verify.error;
      hint = verify.hint;
    } else if (!configured) {
      verified = false;
      error = 'No configurado';
    }
    const { emails, source } = await getEffectiveAlertEmails(prisma);
    res.json({
      configured,
      verified,
      error,
      hint,
      provider: getMailProvider(),
      recipients: emails,
      recipientSource: source,
      envRecipients: getAlertRecipients(),
    });
  } catch (e) {
    next(e);
  }
});

/** Listar destinatarios guardados en la base de datos (solo ADMIN). */
router.get('/recipients', requireRole('ADMIN'), async (_req, res, next) => {
  try {
    const items = await getDbAlertRecipients(prisma);
    const { emails, source } = await getEffectiveAlertEmails(prisma);
    res.json({ items, effective: emails, source });
  } catch (e) {
    next(e);
  }
});

/** Agregar destinatario de alertas (solo ADMIN). */
router.post('/recipients', requireRole('ADMIN'), async (req: AuthRequest, res, next) => {
  try {
    const email = String(req.body?.email ?? '').trim().toLowerCase();
    const label = req.body?.label ? String(req.body.label).trim().slice(0, 120) : null;
    if (!email) throw new AppError(400, 'El correo es obligatorio');
    if (!isValidEmail(email)) throw new AppError(400, 'Correo electrónico no válido');
    const item = await prisma.alertRecipient.upsert({
      where: { email },
      create: { email, label, active: true },
      update: { label: label ?? undefined, active: true },
    });
    await writeAudit(req, 'AlertRecipient', item.id, 'CREATE', { email: item.email, label: item.label });
    res.status(201).json(item);
  } catch (e) {
    next(e);
  }
});

/** Actualizar destinatario (activar/desactivar o etiqueta). */
router.patch('/recipients/:id', requireRole('ADMIN'), async (req: AuthRequest, res, next) => {
  try {
    const existing = await prisma.alertRecipient.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new AppError(404, 'Destinatario no encontrado');
    const data: { label?: string | null; active?: boolean } = {};
    if (req.body?.label !== undefined) data.label = req.body.label ? String(req.body.label).trim().slice(0, 120) : null;
    if (req.body?.active !== undefined) data.active = Boolean(req.body.active);
    const item = await prisma.alertRecipient.update({ where: { id: req.params.id }, data });
    await writeAudit(req, 'AlertRecipient', item.id, 'UPDATE', data);
    res.json(item);
  } catch (e) {
    next(e);
  }
});

/** Eliminar destinatario. */
router.delete('/recipients/:id', requireRole('ADMIN'), async (req: AuthRequest, res, next) => {
  try {
    const existing = await prisma.alertRecipient.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new AppError(404, 'Destinatario no encontrado');
    await prisma.alertRecipient.delete({ where: { id: req.params.id } });
    await writeAudit(req, 'AlertRecipient', existing.id, 'DELETE', { email: existing.email });
    res.json({ ok: true });
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
    if (!result.sent) throw new AppError(503, formatMailError(result.error));
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
    if (!result.sent) throw new AppError(result.reason === 'no-recipients' ? 400 : 503, formatMailError(result.error) || result.reason || 'No se pudo enviar');
    res.json({ ok: true, recipients: result.recipients, alertCount: result.alertCount });
  } catch (e) {
    next(e);
  }
});

export default router;
