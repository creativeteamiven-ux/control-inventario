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
      // SMTP explícito: más fiable en Render/Vercel que service:'gmail'
      options: {
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        auth: { user: gmailUser, pass: gmailPass },
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
        socketTimeout: 15_000,
      } as nodemailer.TransportOptions,
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

export type MailProvider = 'resend' | 'gmail' | 'smtp' | null;

export function getMailProvider(): MailProvider {
  if (process.env.RESEND_API_KEY?.trim()) return 'resend';
  if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) return 'gmail';
  if (process.env.SMTP_HOST) return 'smtp';
  return null;
}

export function isMailerConfigured(): boolean {
  return getMailProvider() !== null;
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
  if (getMailProvider() === 'resend') {
    return sendViaResend(input);
  }
  const t = getTransporter();
  if (!t) {
    console.warn('[Mailer] No configurado (faltan variables SMTP/Gmail/Resend). Se omite el envío.');
    return { sent: false, skipped: true };
  }
  try {
    await Promise.race([
      t.transporter.sendMail({
        from: t.from,
        to: Array.isArray(input.to) ? input.to.join(',') : input.to,
        subject: input.subject,
        html: input.html,
        text: input.text,
      }),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Connection timeout')), SEND_TIMEOUT_MS);
      }),
    ]);
    return { sent: true };
  } catch (e) {
    const msg = (e as Error).message;
    console.error('[Mailer] Error al enviar:', msg);
    return { sent: false, error: msg };
  }
}

function isResendSandbox(): boolean {
  const from = (process.env.MAIL_FROM || 'onboarding@resend.dev').toLowerCase();
  return from.includes('onboarding@resend.dev');
}

function parseResendError(body: string): string {
  try {
    const data = JSON.parse(body) as { message?: string };
    if (data.message) return data.message;
  } catch {
    // texto plano
  }
  return body;
}

async function sendViaResend(input: SendMailInput): Promise<{ sent: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY!.trim();
  const from = process.env.MAIL_FROM || 'The Warehouse <onboarding@resend.dev>';
  const to = (Array.isArray(input.to) ? input.to : [input.to]).map((e) => e.trim().toLowerCase());

  if (isResendSandbox()) {
    const allowed = process.env.RESEND_SANDBOX_EMAIL?.trim().toLowerCase();
    if (allowed) {
      const invalid = to.filter((e) => e !== allowed);
      if (invalid.length > 0) {
        return {
          sent: false,
          error: `Resend (modo prueba): solo puedes enviar a ${allowed}. Destinatarios no permitidos: ${invalid.join(', ')}. Verifica tu dominio en resend.com/domains para enviar a otros.`,
        };
      }
    }
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to, subject: input.subject, html: input.html, text: input.text }),
    });
    if (!res.ok) {
      const body = await res.text();
      return { sent: false, error: parseResendError(body) || `Resend HTTP ${res.status}` };
    }
    return { sent: true };
  } catch (e) {
    return { sent: false, error: (e as Error).message };
  }
}

const VERIFY_TIMEOUT_MS = 12_000;
const SEND_TIMEOUT_MS = 15_000;

function smtpBlockedHint(): string {
  return 'Render plan gratuito bloquea SMTP. Añade RESEND_API_KEY en Render (gratis) o sube a un plan de pago.';
}

function isSmtpConnectivityError(error?: string): boolean {
  if (!error) return false;
  const lower = error.toLowerCase();
  return lower.includes('timeout') || lower.includes('etimedout') || lower.includes('econnrefused') || lower.includes('network');
}

/** Mensaje amigable cuando falla el envío (p. ej. SMTP bloqueado en Render free). */
export function formatMailError(error?: string): string {
  if (!error) return 'No se pudo enviar el correo';
  if (getMailProvider() === 'gmail' && isSmtpConnectivityError(error)) {
    return smtpBlockedHint();
  }
  const lower = error.toLowerCase();
  if (lower.includes('only send testing emails') || lower.includes('verify a domain at resend.com')) {
    return 'Resend (modo prueba): solo puedes enviar al correo de tu cuenta Resend. Deja solo ese destinatario o verifica tu dominio en resend.com/domains.';
  }
  if (lower.includes('resend (modo prueba)')) return error;
  return error;
}

export function getResendSandboxInfo(): { sandbox: boolean; allowedEmail?: string } {
  if (!isResendSandbox()) return { sandbox: false };
  const allowed = process.env.RESEND_SANDBOX_EMAIL?.trim();
  return { sandbox: true, allowedEmail: allowed || undefined };
}

/** Verifica la conexión (Resend: solo comprueba que hay API key; SMTP: handshake con timeout). */
export async function verifyMailer(): Promise<{ ok: boolean; error?: string; hint?: string }> {
  const provider = getMailProvider();
  if (provider === 'resend') return { ok: true };
  if (!provider) return { ok: false, error: 'No hay configuración de correo' };

  resetMailer();
  const t = getTransporter();
  if (!t) return { ok: false, error: 'No hay configuración de correo' };
  try {
    await Promise.race([
      t.transporter.verify(),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Connection timeout')), VERIFY_TIMEOUT_MS);
      }),
    ]);
    return { ok: true };
  } catch (e) {
    const msg = (e as Error).message;
    const hint =
      provider === 'gmail'
        ? smtpBlockedHint()
        : undefined;
    return { ok: false, error: msg, hint };
  }
}

/** Reinicia el transporter cacheado (tras cambiar configuración). */
export function resetMailer(): void {
  cached = null;
}
