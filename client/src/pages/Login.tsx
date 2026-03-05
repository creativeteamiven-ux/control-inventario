import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import toast from 'react-hot-toast';

/** Extrae un mensaje de error en texto desde la respuesta API (evita renderizar objetos y React #31). */
function getErrorMessage(data: unknown, fallback: string): string {
  if (data == null || typeof data !== 'object') return fallback;
  const o = data as Record<string, unknown>;
  if (typeof o.error === 'string') return o.error;
  if (o.error && typeof o.error === 'object' && typeof (o.error as Record<string, unknown>).message === 'string') {
    return (o.error as { message: string }).message;
  }
  if (typeof o.message === 'string') return o.message;
  return fallback;
}

export default function Login() {
  const { user, login, isLoading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to="/dashboard" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await login(email, password);
      toast.success('Bienvenido a DFP RECORDS');
      navigate('/dashboard');
    } catch (err: unknown) {
      const ax = err as { response?: { status?: number; data?: unknown } };
      const status = ax?.response?.status;
      const msg = getErrorMessage(ax?.response?.data, 'Error al iniciar sesión');
      if (status === 401) {
        toast.error('Credenciales incorrectas. Comprueba el email y la contraseña.');
      } else if (status === 404) {
        toast.error('No se encontró el servidor. Comprueba que la URL del API (VITE_API_URL) sea correcta.');
      } else {
        toast.error(msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <img
            src="/img/logo-dfp-records.png"
            alt="DFP RECORDS"
            className="h-20 w-auto max-w-[280px] object-contain mb-4"
          />
          <p className="text-muted mt-1">Gestión de Inventario de Audio</p>
        </div>
        <form onSubmit={handleSubmit} className="bg-card rounded-xl border border-border p-8 shadow-xl">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Email</label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@soundvault.com"
                required
                autoComplete="email"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Contraseña</label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
              />
            </div>
          </div>
          <Button type="submit" className="w-full mt-6" disabled={submitting || isLoading}>
            {submitting ? 'Iniciando sesión...' : 'Iniciar sesión'}
          </Button>
        </form>
        <p className="text-center text-sm text-muted mt-6">
          Demo: admin@soundvault.com / admin123
        </p>
        <p className="text-center text-xs text-muted mt-2">
          Si es la primera vez, en la carpeta <code className="bg-muted px-1 rounded">server</code> ejecuta <code className="bg-muted px-1 rounded">npm run db:seed</code> para crear el usuario admin.
        </p>
      </div>
    </div>
  );
}
