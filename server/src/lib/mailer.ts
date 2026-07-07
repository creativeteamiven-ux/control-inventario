/**
 * Servicio de correo configurable por variables de entorno.
 * Funciona con Gmail (contraseña de aplicación) o con cualquier SMTP.
 * Si no hay configuración, no falla: simplemente omite el envío y lo registra.
 *
 * Variables soportadas:
 *  - Gmail:  GMAIL_USER, GMAIL_APP_PASSWORD
 *  - SMTP:   SMTP_HOST, SMTP_PORT (587), SMTP_SECURE ('true'|'false'), SMTP_USER, SMTP_PASS
 *  - Común:  MAIL_FROM (remitente; por defecto el usuario), ALERT_RECIPIENTS (lista separada por comas)
 */
import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

interface MailerConfig {
  from: string;
  options: nodemailer.TransportOptions;
}

function getConfig(): MailerConfig | null {
  const gmailUser = process.env.GMAIL_USER;
  const gmailPass = process.env.GMAIL_APP_PASSWORD;
  if (gmailUser && gmailPass) {
    return {
      from: process.env.MAIL_FROM || gmailUser,
      options: { service: 'gmail', auth: { user: gmailUser, pass: gmailPass } } as nodemailer.TransportOptions,
    };
  }
  const host = process.env.SMTP_HOST;
  if (host) {
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    return {
      from: process.env.MAIL_FROM || user || 'no-reply@thewarehouse.local',
      options: {
        host,
        port: Number(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === 'true',
        auth: user && pass ? { user, pass } : undefined,
      } as nodemailer.TransportOptions,
    };
  }
  return null;
}

let cached: { transporter: Transporter; from: string } | null = null;

function getTransporter(): { transporter: Transporter; from: string } | null {
  const cfg = getConfig();
  if (!cfg) return null;
  if (!cached) {
    cached = { transporter: nodemailer.createTransport(cfg.options), from: cfg.from };
  }
  return cached;
}

export function isMailerConfigured(): boolean {
  return getConfig() !== null;
}

export function getAlertRecipients(): string[] {
  const raw = process.env.ALERT_RECIPIENTS || '';
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

export interface SendMailInput {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}

export async function sendMail(input: SendMailInput): Promise<{ sent: boolean; skipped?: boolean; error?: string }> {
  const t = getTransporter();
  if (!t) {
    console.warn('[Mailer] No configurado (faltan variables SMTP/Gmail). Se omite el envío.');
    return { sent: false, skipped: true };
  }
  try {
    await t.transporter.sendMail({
      from: t.from,
      to: Array.isArray(input.to) ? input.to.join(',') : input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
    });
    return { sent: true };
  } catch (e) {
    console.error('[Mailer] Error al enviar:', (e as Error).message);
    return { sent: false, error: (e as Error).message };
  }
}

/** Verifica la conexión SMTP. Útil para un endpoint de prueba. */
export async function verifyMailer(): Promise<{ ok: boolean; error?: string }> {
  const t = getTransporter();
  if (!t) return { ok: false, error: 'No hay configuración de correo' };
  try {
    await t.transporter.verify();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** Reinicia el transporter cacheado (tras cambiar configuración). */
export function resetMailer(): void {
  cached = null;
}
