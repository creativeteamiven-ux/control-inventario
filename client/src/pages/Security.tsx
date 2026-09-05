import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Fingerprint, KeyRound, ShieldCheck, Trash2 } from 'lucide-react';
import {
  startRegistration,
  startAuthentication,
  browserSupportsWebAuthn,
} from '@simplewebauthn/browser';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Link } from 'react-router-dom';

interface SecurityStatus {
  hasPin: boolean;
  webauthnCount: number;
  canApproveMovements: boolean;
}

export default function Security() {
  const queryClient = useQueryClient();
  const [pin, setPin] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [password, setPassword] = useState('');
  const [savingPin, setSavingPin] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [removing, setRemoving] = useState(false);

  const { data: status, isLoading } = useQuery({
    queryKey: ['security-status'],
    queryFn: async () => {
      const { data } = await api.get<SecurityStatus>('/api/security/status');
      return data;
    },
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['security-status'] });

  const savePin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pin !== pinConfirm) {
      toast.error('Los PIN no coinciden');
      return;
    }
    setSavingPin(true);
    try {
      await api.post('/api/security/pin', { pin, password });
      toast.success(status?.hasPin ? 'PIN actualizado' : 'PIN configurado');
      setPin('');
      setPinConfirm('');
      setPassword('');
      refresh();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Error';
      toast.error(msg);
    } finally {
      setSavingPin(false);
    }
  };

  const removePin = async () => {
    const pwd = prompt('Confirma tu contraseña para quitar el PIN');
    if (!pwd) return;
    setRemoving(true);
    try {
      await api.delete('/api/security/pin', { data: { password: pwd } });
      toast.success('PIN eliminado');
      refresh();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Error';
      toast.error(msg);
    } finally {
      setRemoving(false);
    }
  };

  const enrollWebAuthn = async () => {
    if (!browserSupportsWebAuthn()) {
      toast.error('Este navegador o dispositivo no soporta biometría WebAuthn');
      return;
    }
    setRegistering(true);
    try {
      const { data: options } = await api.post('/api/security/webauthn/register/options');
      const attestation = await startRegistration({ optionsJSON: options });
      await api.post('/api/security/webauthn/register/verify', attestation);
      toast.success('Biometría del dispositivo registrada (Face ID / huella)');
      refresh();
    } catch (err: unknown) {
      const name = (err as { name?: string })?.name;
      if (name === 'NotAllowedError') {
        toast.error('Registro cancelado');
      } else {
        const msg =
          (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
          (err as Error)?.message ||
          'No se pudo registrar';
        toast.error(msg);
      }
    } finally {
      setRegistering(false);
    }
  };

  const clearWebAuthn = async () => {
    const pwd = prompt('Confirma tu contraseña para quitar las passkeys');
    if (!pwd) return;
    setRemoving(true);
    try {
      await api.delete('/api/security/webauthn', { data: { password: pwd } });
      toast.success('Biometría del dispositivo eliminada');
      refresh();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Error';
      toast.error(msg);
    } finally {
      setRemoving(false);
    }
  };

  /** Prueba rápida de autenticación biométrica */
  const testWebAuthn = async () => {
    try {
      const { data: options } = await api.post('/api/security/webauthn/auth/options');
      const assertion = await startAuthentication({ optionsJSON: options });
      await api.post('/api/security/webauthn/auth/verify', assertion);
      toast.success('Biometría verificada correctamente');
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        (err as Error)?.message ||
        'Falló la verificación';
      toast.error(msg);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 max-w-xl mx-auto">
      <div>
        <h1 className="font-display text-2xl font-bold flex items-center gap-2">
          <ShieldCheck className="h-6 w-6 text-primary" /> Seguridad
        </h1>
        <p className="text-sm text-muted mt-1">
          Configura PIN y biometría del teléfono (Face ID / huella) para autorizar salidas en{' '}
          <Link to="/movements" className="text-primary underline">
            Movimientos
          </Link>
          .
        </p>
      </div>

      {isLoading ? (
        <p className="text-muted">Cargando…</p>
      ) : (
        <div className="rounded-xl border border-border bg-card p-4 text-sm space-y-1">
          <p>
            PIN: <span className="font-medium">{status?.hasPin ? 'Configurado' : 'No configurado'}</span>
          </p>
          <p>
            Biometría dispositivo:{' '}
            <span className="font-medium">
              {status?.webauthnCount ? `${status.webauthnCount} registrada(s)` : 'No registrada'}
            </span>
          </p>
          {!status?.canApproveMovements && (
            <p className="text-amber-400 text-xs mt-2">
              Debes configurar al menos PIN o biometría para poder autorizar traslados pendientes.
            </p>
          )}
        </div>
      )}

      <form onSubmit={savePin} className="bg-card rounded-xl border border-border p-4 space-y-3">
        <h2 className="font-semibold flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-primary" /> PIN de autorización
        </h2>
        <p className="text-xs text-muted">4 a 6 dígitos. Se usa al autorizar traslados de equipos.</p>
        <Input
          type="password"
          inputMode="numeric"
          autoComplete="new-password"
          placeholder="Nuevo PIN"
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
          maxLength={6}
        />
        <Input
          type="password"
          inputMode="numeric"
          autoComplete="new-password"
          placeholder="Confirmar PIN"
          value={pinConfirm}
          onChange={(e) => setPinConfirm(e.target.value.replace(/\D/g, '').slice(0, 6))}
          maxLength={6}
        />
        <Input
          type="password"
          autoComplete="current-password"
          placeholder="Tu contraseña actual"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={savingPin || pin.length < 4}>
            {savingPin ? 'Guardando…' : status?.hasPin ? 'Cambiar PIN' : 'Guardar PIN'}
          </Button>
          {status?.hasPin && (
            <Button type="button" variant="ghost" className="text-destructive" onClick={removePin} disabled={removing}>
              <Trash2 className="h-4 w-4 mr-1" /> Quitar PIN
            </Button>
          )}
        </div>
      </form>

      <div className="bg-card rounded-xl border border-border p-4 space-y-3">
        <h2 className="font-semibold flex items-center gap-2">
          <Fingerprint className="h-4 w-4 text-primary" /> Face ID / huella (WebAuthn)
        </h2>
        <p className="text-xs text-muted">
          Usa la biometría del teléfono o PC. No guardamos tu cara ni huella en el servidor: solo una clave
          criptográfica del dispositivo. Requiere HTTPS.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={enrollWebAuthn} disabled={registering}>
            {registering ? 'Esperando dispositivo…' : status?.webauthnCount ? 'Agregar otro dispositivo' : 'Registrar biometría'}
          </Button>
          {(status?.webauthnCount ?? 0) > 0 && (
            <>
              <Button variant="outline" onClick={testWebAuthn}>
                Probar
              </Button>
              <Button variant="ghost" className="text-destructive" onClick={clearWebAuthn} disabled={removing}>
                Quitar biometría
              </Button>
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
}
