import { useState } from 'react';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { Mail, BellRing, CheckCircle2, XCircle, Send, Info } from 'lucide-react';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface MailStatus {
  configured: boolean;
  verified: boolean;
  error?: string;
  recipients: string[];
}

interface AlertsResponse {
  count: number;
  bySeverity: { critical: number; warning: number; info: number };
}

export default function Settings() {
  const [testEmail, setTestEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [sendingDigest, setSendingDigest] = useState(false);

  const { data: mail, refetch: refetchMail, isLoading: loadingMail } = useQuery<MailStatus>({
    queryKey: ['mail-status'],
    queryFn: async () => {
      const { data } = await api.get('/api/alerts/mail-status');
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
    setSendingDigest(true);
    try {
      const { data } = await api.post('/api/alerts/send-digest', {});
      toast.success(`Resumen enviado a ${data.recipients.length} destinatario(s) (${data.alertCount} alertas)`);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Error al enviar';
      toast.error(msg);
    } finally {
      setSendingDigest(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 max-w-3xl">
      <h1 className="font-display text-2xl font-bold text-foreground">Configuración</h1>

      {/* Estado del correo */}
      <section className="bg-card rounded-xl border border-border p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Mail className="h-5 w-5 text-primary" />
          <h2 className="font-display font-semibold text-lg">Correo y alertas</h2>
        </div>

        {loadingMail ? (
          <p className="text-muted text-sm">Comprobando...</p>
        ) : (
          <div className="flex items-center gap-2 text-sm">
            {mail?.configured && mail?.verified ? (
              <><CheckCircle2 className="h-5 w-5 text-green-500" /><span className="text-green-600 font-medium">Correo configurado y verificado</span></>
            ) : mail?.configured ? (
              <><XCircle className="h-5 w-5 text-amber-500" /><span className="text-amber-600">Configurado pero no se pudo verificar: {mail?.error}</span></>
            ) : (
              <><XCircle className="h-5 w-5 text-muted" /><span className="text-muted">Correo no configurado</span></>
            )}
            <Button variant="ghost" size="sm" onClick={() => refetchMail()}>Revisar</Button>
          </div>
        )}

        {!mail?.configured && (
          <div className="rounded-lg bg-blue-500/10 border border-blue-500/30 p-4 text-sm space-y-2">
            <div className="flex items-center gap-2 font-medium text-blue-600 dark:text-blue-400">
              <Info className="h-4 w-4" /> Cómo activar el correo con Gmail (gratuito)
            </div>
            <ol className="list-decimal list-inside space-y-1 text-foreground/90">
              <li>Activa la verificación en 2 pasos en tu cuenta de Google.</li>
              <li>Crea una <strong>Contraseña de aplicación</strong> en myaccount.google.com → Seguridad.</li>
              <li>En el servidor (Render → Environment) define: <code className="font-mono text-xs">GMAIL_USER</code>, <code className="font-mono text-xs">GMAIL_APP_PASSWORD</code> y opcionalmente <code className="font-mono text-xs">ALERT_RECIPIENTS</code> (correos separados por coma).</li>
              <li>Reinicia el servicio y vuelve aquí para enviar una prueba.</li>
            </ol>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium mb-1.5">Enviar correo de prueba a</label>
            <Input
              type="email"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              placeholder="(vacío = tu propio correo)"
            />
          </div>
          <Button onClick={sendTest} disabled={sending || !mail?.configured} className="min-h-touch sm:min-h-0">
            <Send className="h-4 w-4 mr-2" /> {sending ? 'Enviando...' : 'Probar'}
          </Button>
        </div>

        {mail?.recipients && mail.recipients.length > 0 && (
          <p className="text-sm text-muted">Destinatarios de alertas: {mail.recipients.join(', ')}</p>
        )}
      </section>

      {/* Resumen de alertas */}
      <section className="bg-card rounded-xl border border-border p-6 space-y-4">
        <div className="flex items-center gap-2">
          <BellRing className="h-5 w-5 text-primary" />
          <h2 className="font-display font-semibold text-lg">Alertas actuales</h2>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg bg-red-500/10 p-3 text-center">
            <p className="text-2xl font-bold text-red-500">{alerts?.bySeverity.critical ?? 0}</p>
            <p className="text-xs text-muted">Críticas</p>
          </div>
          <div className="rounded-lg bg-amber-500/10 p-3 text-center">
            <p className="text-2xl font-bold text-amber-500">{alerts?.bySeverity.warning ?? 0}</p>
            <p className="text-xs text-muted">Advertencias</p>
          </div>
          <div className="rounded-lg bg-blue-500/10 p-3 text-center">
            <p className="text-2xl font-bold text-blue-500">{alerts?.bySeverity.info ?? 0}</p>
            <p className="text-xs text-muted">Informativas</p>
          </div>
        </div>
        <Button variant="outline" onClick={sendDigest} disabled={sendingDigest || !mail?.configured} className="w-full sm:w-auto min-h-touch sm:min-h-0">
          <Send className="h-4 w-4 mr-2" /> {sendingDigest ? 'Enviando...' : 'Enviar resumen de alertas por correo ahora'}
        </Button>
        <p className="text-xs text-muted">
          Para envíos automáticos diarios, programa un servicio externo (ej. cron-job.org o un Cron Job de Render) que haga
          POST a <code className="font-mono">/api/alerts/send-digest</code>.
        </p>
      </section>
    </motion.div>
  );
}
