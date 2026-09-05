import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Fingerprint, KeyRound, Loader2 } from 'lucide-react';
import { startAuthentication, browserSupportsWebAuthn } from '@simplewebauthn/browser';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface SecurityStatus {
  hasPin: boolean;
  webauthnCount: number;
  canApproveMovements: boolean;
}

interface AuthorizeModalProps {
  open: boolean;
  title?: string;
  description?: string;
  onClose: () => void;
  /** Recibe el approvalToken tras PIN o WebAuthn exitoso */
  onAuthorized: (approvalToken: string) => Promise<void>;
}

export default function AuthorizeModal({
  open,
  title = 'Confirmar autorización',
  description = 'Confirma con biometría del dispositivo o con tu PIN para autorizar el traslado.',
  onClose,
  onAuthorized,
}: AuthorizeModalProps) {
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);

  const { data: status, isLoading } = useQuery({
    queryKey: ['security-status'],
    queryFn: async () => {
      const { data } = await api.get<SecurityStatus>('/api/security/status');
      return data;
    },
    enabled: open,
  });

  if (!open) return null;

  const finish = async (approvalToken: string) => {
    setBusy(true);
    try {
      await onAuthorized(approvalToken);
      setPin('');
      onClose();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Error al autorizar';
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  const withPin = async () => {
    if (pin.length < 4) {
      toast.error('Ingresa tu PIN');
      return;
    }
    setBusy(true);
    try {
      const { data } = await api.post<{ approvalToken: string }>('/api/security/pin/verify', { pin });
      await finish(data.approvalToken);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'PIN incorrecto';
      toast.error(msg);
      setBusy(false);
    }
  };

  const withWebAuthn = async () => {
    if (!browserSupportsWebAuthn()) {
      toast.error('Este dispositivo no soporta biometría WebAuthn');
      return;
    }
    setBusy(true);
    try {
      const { data: options } = await api.post('/api/security/webauthn/auth/options');
      const assertion = await startAuthentication({ optionsJSON: options });
      const { data } = await api.post<{ approvalToken: string }>('/api/security/webauthn/auth/verify', assertion);
      await finish(data.approvalToken);
    } catch (err: unknown) {
      const name = (err as { name?: string })?.name;
      if (name === 'NotAllowedError') toast.error('Biometría cancelada');
      else {
        const msg =
          (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
          (err as Error)?.message ||
          'No se pudo verificar';
        toast.error(msg);
      }
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => !busy && onClose()}>
      <div
        className="bg-card rounded-xl border border-border p-6 shadow-xl w-full max-w-sm space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <h3 className="font-semibold text-lg">{title}</h3>
          <p className="text-sm text-muted mt-1">{description}</p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : !status?.canApproveMovements ? (
          <div className="space-y-3 text-sm">
            <p className="text-amber-400">
              Aún no tienes PIN ni biometría configurados. Configúralos antes de autorizar traslados.
            </p>
            <Button asChild className="w-full">
              <Link to="/security" onClick={onClose}>
                Ir a Seguridad
              </Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {(status.webauthnCount ?? 0) > 0 && (
              <Button className="w-full min-h-touch" onClick={withWebAuthn} disabled={busy}>
                <Fingerprint className="h-4 w-4 mr-2" />
                {busy ? 'Verificando…' : 'Autorizar con Face ID / huella'}
              </Button>
            )}

            {status.hasPin && (
              <div className="space-y-2">
                {(status.webauthnCount ?? 0) > 0 && (
                  <p className="text-xs text-muted text-center">o usa tu PIN</p>
                )}
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
                  <Input
                    type="password"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="PIN (4–6 dígitos)"
                    className="pl-9"
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    onKeyDown={(e) => e.key === 'Enter' && withPin()}
                    maxLength={6}
                    disabled={busy}
                  />
                </div>
                <Button className="w-full" variant="outline" onClick={withPin} disabled={busy || pin.length < 4}>
                  Autorizar con PIN
                </Button>
              </div>
            )}
          </div>
        )}

        <Button variant="ghost" className="w-full" onClick={onClose} disabled={busy}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}
