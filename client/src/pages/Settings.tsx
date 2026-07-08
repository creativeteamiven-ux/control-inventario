import { useState } from 'react';
import { motion } from 'framer-motion';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Mail, BellRing, CheckCircle2, XCircle, Send, Info, Users, Plus, Trash2, UserPlus,
} from 'lucide-react';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface MailStatus {
  configured: boolean;
  verified: boolean | null;
  error?: string;
  hint?: string;
  provider?: 'resend' | 'gmail' | 'smtp' | null;
  resendSandbox?: boolean;
  resendAllowedEmail?: string;
  recipients: string[];
  recipientSource?: 'database' | 'env' | 'admins' | 'none';
  envRecipients?: string[];
}

const PROVIDER_LABELS: Record<string, string> = {
  resend: 'Resend (HTTP)',
  gmail: 'Gmail SMTP',
  smtp: 'SMTP personalizado',
};

interface AlertRecipient {
  id: string;
  email: string;
  label: string | null;
  active: boolean;
  createdAt: string;
}

interface RecipientsResponse {
  items: AlertRecipient[];
  effective: string[];
  source: 'database' | 'env' | 'admins' | 'none';
}

interface AlertsResponse {
  count: number;
  bySeverity: { critical: number; warning: number; info: number };
}

const SOURCE_LABELS: Record<string, string> = {
  database: 'Lista configurada en la aplicación',
  env: 'Variable de entorno ALERT_RECIPIENTS (respaldo)',
  admins: 'Correos de usuarios ADMIN (respaldo)',
  none: 'Sin destinatarios configurados',
};

export default function Settings() {
  const queryClient = useQueryClient();
  const [testEmail, setTestEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [sendingDigest, setSendingDigest] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [adding, setAdding] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const { data: mail, isLoading: loadingMail } = useQuery<MailStatus>({
    queryKey: ['mail-status'],
    queryFn: async () => {
      const { data } = await api.get('/api/alerts/mail-status');
      return data;
    },
    staleTime: 30_000,
  });

  const { data: recipientsData, isLoading: loadingRecipients } = useQuery<RecipientsResponse>({
    queryKey: ['alert-recipients'],
    queryFn: async () => {
      const { data } = await api.get('/api/alerts/recipients');
      return data;
    },
  });

  const { data: alerts } = useQuery<AlertsResponse>({
    queryKey: ['alerts'],
    queryFn: async () => {
      const { data } = await api.get('/api/alerts');
      return data;
    },
  });

  const recipients = recipientsData?.items ?? [];
  const activeCount = recipients.filter((r) => r.active).length;

  const invalidateMail = () => {
    queryClient.invalidateQueries({ queryKey: ['mail-status'] });
    queryClient.invalidateQueries({ queryKey: ['alert-recipients'] });
  };

  const sendTest = async () => {
    setSending(true);
    try {
      const { data } = await api.post('/api/alerts/test', testEmail ? { to: testEmail } : {});
      toast.success(`Correo de prueba enviado a ${data.to}`);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Error al enviar';
      toast.error(msg);
    } finally {
      setSending(false);
    }
  };

  const sendDigest = async () => {
    const effective = recipientsData?.effective ?? [];
    if (effective.length === 0) {
      toast.error('Agrega al menos un destinatario en la sección de arriba antes de enviar el resumen.');
      return;
    }
    setSendingDigest(true);
    try {
      const { data } = await api.post('/api/alerts/send-digest', {});
      const n = data.alertCount ?? 0;
      toast.success(
        n === 0
          ? `Resumen enviado a ${data.recipients.length} destinatario(s). Sin alertas pendientes — todo en orden.`
          : `Resumen enviado a ${data.recipients.length} destinatario(s) (${n} alerta(s))`
      );
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Error al enviar';
      toast.error(msg, { duration: 8000 });
    } finally {
      setSendingDigest(false);
    }
  };

  const addRecipient = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = newEmail.trim();
    if (!email) {
      toast.error('Ingresa un correo electrónico');
      return;
    }
    setAdding(true);
    try {
      await api.post('/api/alerts/recipients', { email, label: newLabel.trim() || undefined });
      setNewEmail('');
      setNewLabel('');
      invalidateMail();
      toast.success('Destinatario agregado');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'No se pudo agregar';
      toast.error(msg);
    } finally {
      setAdding(false);
    }
  };

  const toggleRecipient = async (item: AlertRecipient) => {
    try {
      await api.patch(`/api/alerts/recipients/${item.id}`, { active: !item.active });
      invalidateMail();
    } catch {
      toast.error('Error al actualizar destinatario');
    }
  };

  const removeRecipient = async (item: AlertRecipient) => {
    if (!confirm(`¿Quitar a ${item.email} de la lista de alertas?`)) return;
    try {
      await api.delete(`/api/alerts/recipients/${item.id}`);
      invalidateMail();
      toast.success('Destinatario eliminado');
    } catch {
      toast.error('Error al eliminar');
    }
  };

  const checkConnection = async () => {
    setVerifying(true);
    try {
      const { data } = await api.get<MailStatus>('/api/alerts/mail-status', { params: { verify: '1' } });
      queryClient.setQueryData(['mail-status'], data);
      if (data.verified) {
        toast.success('Conexión de correo verificada');
      } else if (data.hint) {
        toast.error(data.hint, { duration: 8000 });
      } else {
        toast.error(data.error || 'No se pudo verificar la conexión');
      }
    } catch {
      toast.error('Error al comprobar el correo');
    } finally {
      setVerifying(false);
    }
  };

  const mailStatusLabel = () => {
    if (loadingMail) return <span className="text-sm text-muted">Cargando...</span>;
    if (!mail?.configured) {
      return (
        <span className="inline-flex items-center gap-1.5 text-sm text-muted">
          <XCircle className="h-4 w-4" /> No configurado
        </span>
      );
    }
    if (mail.provider === 'resend') {
      return (
        <span className="inline-flex items-center gap-1.5 text-sm text-green-500 font-medium">
          <CheckCircle2 className="h-4 w-4" /> {PROVIDER_LABELS.resend}
        </span>
      );
    }
    if (mail.verified === true) {
      return (
        <span className="inline-flex items-center gap-1.5 text-sm text-green-500 font-medium">
          <CheckCircle2 className="h-4 w-4" /> Conectado ({PROVIDER_LABELS[mail.provider ?? ''] ?? 'SMTP'})
        </span>
      );
    }
    if (mail.verified === false) {
      return (
        <span className="inline-flex items-center gap-1.5 text-sm text-amber-500">
          <XCircle className="h-4 w-4" /> Error de verificación
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 text-sm text-blue-500">
        <CheckCircle2 className="h-4 w-4" /> Configurado ({PROVIDER_LABELS[mail.provider ?? ''] ?? 'SMTP'})
      </span>
    );
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 max-w-3xl">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">Configuración</h1>
        <p className="text-sm text-muted mt-1">Correo, destinatarios de alertas y envíos automáticos.</p>
      </div>

      {/* Estado del servidor de correo */}
      <section className="bg-card rounded-xl border border-border p-6 space-y-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            <h2 className="font-display font-semibold text-lg">Servidor de correo</h2>
          </div>
          {mailStatusLabel()}
        </div>

        {!mail?.configured && (
          <div className="rounded-lg bg-blue-500/10 border border-blue-500/30 p-4 text-sm space-y-3">
            <div className="flex items-center gap-2 font-medium text-blue-600 dark:text-blue-400">
              <Info className="h-4 w-4 shrink-0" /> Opciones en Render (backend)
            </div>
            <div className="space-y-2 text-xs sm:text-sm text-foreground/90">
              <p><strong>Recomendado (plan gratuito de Render):</strong> Resend — crea cuenta en resend.com, verifica tu dominio o usa el correo de prueba, y en Render añade:</p>
              <ul className="list-disc list-inside ml-1 space-y-0.5 font-mono text-xs">
                <li>RESEND_API_KEY = re_...</li>
                <li>MAIL_FROM = The Warehouse &lt;tu@correo.com&gt;</li>
              </ul>
              <p className="pt-1"><strong>Alternativa (plan de pago Render):</strong> Gmail con contraseña de aplicación:</p>
              <ul className="list-disc list-inside ml-1 space-y-0.5 font-mono text-xs">
                <li>GMAIL_USER</li>
                <li>GMAIL_APP_PASSWORD</li>
              </ul>
            </div>
          </div>
        )}

        {mail?.configured && mail.provider === 'gmail' && mail.verified !== true && (
          <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-4 text-sm space-y-1">
            <p className="font-medium text-amber-600 dark:text-amber-400">Gmail SMTP en Render plan gratuito</p>
            <p className="text-xs sm:text-sm text-foreground/90">
              Render bloquea los puertos SMTP (465/587) en el plan gratuito. Por eso aparece &quot;Connection timeout&quot;.
              Añade <code className="font-mono">RESEND_API_KEY</code> en Render (gratis, 100 correos/día) o sube a un plan de pago.
            </p>
          </div>
        )}

        {mail?.configured && mail.verified === false && mail?.error && (
          <p className="text-sm text-amber-600">{mail.error}</p>
        )}
        {mail?.hint && (
          <p className="text-sm text-muted">{mail.hint}</p>
        )}

        <div className="flex flex-col sm:flex-row gap-2 sm:items-end pt-1">
          <div className="flex-1">
            <label className="block text-sm font-medium mb-1.5">Correo de prueba</label>
            <Input
              type="email"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              placeholder="Vacío = tu correo de sesión"
            />
          </div>
          <Button onClick={sendTest} disabled={sending || !mail?.configured} className="min-h-touch sm:min-h-0 shrink-0">
            <Send className="h-4 w-4 mr-2" /> {sending ? 'Enviando...' : 'Enviar prueba'}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={checkConnection}
            disabled={verifying || !mail?.configured || mail?.provider === 'resend'}
            className="shrink-0"
          >
            {verifying ? 'Comprobando...' : 'Revisar conexión'}
          </Button>
        </div>
      </section>

      {/* Destinatarios de alertas */}
      <section className="bg-card rounded-xl border border-border p-6 space-y-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              <h2 className="font-display font-semibold text-lg">Destinatarios de alertas</h2>
            </div>
            <p className="text-sm text-muted mt-1">
              Quienes reciben el resumen diario y las notificaciones por correo.
            </p>
          </div>
          {recipientsData && (
            <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-primary/15 text-primary">
              {activeCount} activo{activeCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        <form onSubmit={addRecipient} className="rounded-lg border border-border bg-background/50 p-4 space-y-3">
          <p className="text-sm font-medium flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-primary" /> Agregar destinatario
          </p>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted mb-1">Correo electrónico *</label>
              <Input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="ejemplo@correo.com"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1">Nombre (opcional)</label>
              <Input
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="Ej: Equipo técnico"
              />
            </div>
          </div>
          <Button type="submit" disabled={adding} size="sm">
            <Plus className="h-4 w-4 mr-2" /> {adding ? 'Agregando...' : 'Agregar a la lista'}
          </Button>
        </form>

        {loadingRecipients ? (
          <p className="text-sm text-muted text-center py-6">Cargando destinatarios...</p>
        ) : recipients.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-8 text-center text-muted text-sm">
            <Mail className="h-10 w-10 mx-auto mb-2 opacity-40" />
            <p>No hay destinatarios en la lista.</p>
            <p className="text-xs mt-2">
              {recipientsData?.source === 'env' && mail?.envRecipients?.length
                ? `Se usará ALERT_RECIPIENTS del servidor: ${mail.envRecipients.join(', ')}`
                : recipientsData?.source === 'admins'
                  ? 'Mientras tanto se enviará a los usuarios ADMIN.'
                  : 'Agrega al menos un correo para recibir alertas.'}
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {recipients.map((r) => (
              <li
                key={r.id}
                className={cn(
                  'flex items-center gap-3 rounded-lg border px-4 py-3 transition-colors',
                  r.active ? 'border-border bg-card-hover/30' : 'border-border/50 opacity-60'
                )}
              >
                <div className="h-9 w-9 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                  <Mail className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{r.email}</p>
                  {r.label && <p className="text-xs text-muted truncate">{r.label}</p>}
                </div>
                <label className="flex items-center gap-2 text-xs text-muted shrink-0 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={r.active}
                    onChange={() => toggleRecipient(r)}
                    className="h-4 w-4 rounded border-border"
                  />
                  Activo
                </label>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted hover:text-destructive shrink-0"
                  onClick={() => removeRecipient(r)}
                  title="Eliminar"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}

        {mail?.resendSandbox && (
          <p className="text-xs text-amber-600 dark:text-amber-400 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2">
            Modo prueba Resend{mail.resendAllowedEmail ? (
              <> — destinatarios permitidos: solo <strong>{mail.resendAllowedEmail}</strong></>
            ) : (
              <> — solo puedes enviar al correo de tu cuenta Resend</>
            )}
            . Para otros correos, verifica tu dominio en Resend.
          </p>
        )}

        {mail?.provider === 'resend' && !mail?.resendSandbox && (
          <p className="text-xs text-muted rounded-lg border border-border px-3 py-2">
            Con <code className="font-mono">onboarding@resend.dev</code> (plan gratis sin dominio), los destinatarios deben ser
            el mismo correo de tu cuenta Resend. Para enviar a otros correos, verifica tu dominio en Resend.
          </p>
        )}

        {recipientsData && (
          <p className="text-xs text-muted border-t border-border pt-3">
            <strong>Envío actual:</strong> {SOURCE_LABELS[recipientsData.source] ?? recipientsData.source}
            {recipientsData.effective.length > 0 && (
              <> — {recipientsData.effective.join(', ')}</>
            )}
          </p>
        )}
      </section>

      {/* Alertas y envío manual */}
      <section className="bg-card rounded-xl border border-border p-6 space-y-4">
        <div className="flex items-center gap-2">
          <BellRing className="h-5 w-5 text-primary" />
          <h2 className="font-display font-semibold text-lg">Alertas actuales</h2>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-4 text-center">
            <p className="text-2xl font-bold text-red-500">{alerts?.bySeverity.critical ?? 0}</p>
            <p className="text-xs text-muted mt-0.5">Críticas</p>
          </div>
          <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-4 text-center">
            <p className="text-2xl font-bold text-amber-500">{alerts?.bySeverity.warning ?? 0}</p>
            <p className="text-xs text-muted mt-0.5">Advertencias</p>
          </div>
          <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-4 text-center">
            <p className="text-2xl font-bold text-blue-500">{alerts?.bySeverity.info ?? 0}</p>
            <p className="text-xs text-muted mt-0.5">Informativas</p>
          </div>
        </div>
        <Button
          variant="outline"
          onClick={sendDigest}
          disabled={sendingDigest || !mail?.configured || (recipientsData?.effective.length ?? 0) === 0}
          className="w-full sm:w-auto min-h-touch sm:min-h-0"
        >
          <Send className="h-4 w-4 mr-2" />
          {sendingDigest ? 'Enviando...' : 'Enviar resumen ahora a todos los destinatarios'}
        </Button>
        <p className="text-xs text-muted">
          {(alerts?.count ?? 0) === 0
            ? 'Hay 0 alertas ahora, pero el resumen manual igual se envía con el mensaje "Todo en orden". '
            : ''}
          El envío automático diario usa el programador del servidor o un cron externo con{' '}
          <code className="font-mono">POST /api/alerts/cron/digest</code>.
        </p>
      </section>
    </motion.div>
  );
}
