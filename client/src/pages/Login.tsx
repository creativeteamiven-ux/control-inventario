import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Mail, Lock, Music2 } from 'lucide-react';
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

/** Barras de onda decorativas (estilo audio) - abajo */
function WaveBars() {
  const bars = 28;
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
      <div className="absolute bottom-0 left-0 right-0 flex items-end justify-center gap-1 h-36 px-4">
        {Array.from({ length: bars }).map((_, i) => (
          <motion.div
            key={i}
            className="w-1.5 rounded-full bg-primary/40 min-h-[6px]"
            initial={{ height: 10 }}
            animate={{
              height: [10, 16 + Math.sin(i * 0.4) * 28, 10],
            }}
            transition={{
              duration: 1 + (i % 6) * 0.2,
              repeat: Infinity,
              repeatType: 'reverse',
              delay: i * 0.04,
            }}
          />
        ))}
      </div>
    </div>
  );
}

/** Ondas arriba (simétrico) */
function WaveBarsTop() {
  const bars = 20;
  return (
    <div className="absolute top-0 left-0 right-0 overflow-hidden pointer-events-none" aria-hidden>
      <div className="flex items-start justify-center gap-1 h-24 px-4 pt-2">
        {Array.from({ length: bars }).map((_, i) => (
          <motion.div
            key={i}
            className="w-1 rounded-full bg-indigo-500/25 min-h-[4px]"
            initial={{ height: 6 }}
            animate={{
              height: [6, 14 + Math.cos(i * 0.6) * 14, 6],
            }}
            transition={{
              duration: 1.4 + (i % 4) * 0.1,
              repeat: Infinity,
              repeatType: 'reverse',
              delay: i * 0.06,
            }}
          />
        ))}
      </div>
    </div>
  );
}

/** Partículas/orbes flotantes de fondo */
function FloatingOrbs() {
  const orbs = [
    { size: 120, x: '10%', y: '20%', delay: 0, duration: 8 },
    { size: 80, x: '85%', y: '70%', delay: 1, duration: 10 },
    { size: 100, x: '70%', y: '15%', delay: 2, duration: 9 },
    { size: 60, x: '25%', y: '80%', delay: 0.5, duration: 7 },
    { size: 90, x: '50%', y: '50%', delay: 1.5, duration: 11 },
  ];
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
      {orbs.map((orb, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full bg-primary/10 blur-3xl"
          style={{
            width: orb.size,
            height: orb.size,
            left: orb.x,
            top: orb.y,
            x: '-50%',
            y: '-50%',
          }}
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{
            duration: orb.duration,
            repeat: Infinity,
            delay: orb.delay,
          }}
        />
      ))}
    </div>
  );
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
      toast.success('Bienvenido a The Warehouse');
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
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden p-4 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950">
      {/* Capa con gradiente que pulsa suavemente */}
      <motion.div
        className="absolute inset-0 bg-gradient-to-br from-indigo-950/40 via-transparent to-slate-900/40"
        animate={{ opacity: [0.4, 0.7, 0.4] }}
        transition={{ duration: 5, repeat: Infinity, repeatType: 'reverse' }}
      />
      {/* Fondo con gradiente y textura sutil */}
      <motion.div
        className="absolute inset-0"
        animate={{
          opacity: [0.8, 1, 0.8],
        }}
        transition={{ duration: 4, repeat: Infinity }}
        style={{
          background: 'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(99,102,241,0.2), transparent 50%)',
        }}
      />
      <div
        className="absolute inset-0 opacity-50"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%236366f1' fill-opacity='0.03'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}
      />

      <FloatingOrbs />
      <WaveBarsTop />
      <WaveBars />

      <motion.div
        className="w-full max-w-md relative z-10"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      >
        {/* Logo y título */}
        <motion.div
          className="flex flex-col items-center mb-8"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.15, duration: 0.5, type: 'spring', stiffness: 120 }}
        >
          <motion.div
            className="relative mb-4"
            animate={{ y: [0, -6, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            whileHover={{ scale: 1.03, y: 0 }}
          >
            <img
              src="/img/logo-dfp-records.png"
              alt="The Warehouse"
              className="h-20 w-auto max-w-[280px] object-contain drop-shadow-lg"
            />
            <motion.span
              className="absolute -right-2 -top-2 flex h-8 w-8 items-center justify-center rounded-full bg-primary/20 text-primary"
              initial={{ scale: 0, rotate: -180 }}
              animate={{
                scale: 1,
                rotate: 0,
                boxShadow: ['0 0 0 0 rgba(99, 102, 241, 0.4)', '0 0 0 12px rgba(99, 102, 241, 0)'],
              }}
              transition={{
                scale: { delay: 0.4, type: 'spring', stiffness: 200 },
                boxShadow: { duration: 1.5, repeat: Infinity, repeatDelay: 1 },
              }}
            >
              <Music2 className="h-4 w-4" />
            </motion.span>
          </motion.div>
          <motion.p
            className="text-slate-400 text-center text-sm font-medium tracking-wide"
            animate={{ opacity: [0.7, 1, 0.7] }}
            transition={{ duration: 2.5, repeat: Infinity }}
          >
            Gestión de Inventario de Audio
          </motion.p>
          <motion.p
            className="text-slate-500 text-center text-xs mt-1 max-w-xs"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
          >
            Ingresa tus datos para acceder al sistema
          </motion.p>
        </motion.div>

        {/* Card del formulario */}
        <motion.form
          onSubmit={handleSubmit}
          className="relative bg-slate-800/80 backdrop-blur-xl rounded-2xl border border-slate-700/50 p-8 shadow-2xl shadow-black/30"
          initial={{ opacity: 0, y: 20 }}
          animate={{
            opacity: 1,
            y: 0,
            boxShadow: [
              '0 25px 50px -12px rgba(0,0,0,0.35)',
              '0 25px 50px -12px rgba(99, 102, 241, 0.08)',
              '0 25px 50px -12px rgba(0,0,0,0.35)',
            ],
          }}
          transition={{
            opacity: { delay: 0.25, duration: 0.4 },
            y: { delay: 0.25, duration: 0.5, type: 'spring', stiffness: 100 },
            boxShadow: { duration: 3, repeat: Infinity, repeatType: 'reverse' },
          }}
          whileHover={{ y: -2, scale: 1.01 }}
        >
          <div className="space-y-5">
            <motion.div
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4, type: 'spring', stiffness: 80 }}
              whileFocusWithin={{ scale: 1.01 }}
            >
              <label className="block text-sm font-medium text-slate-200 mb-2">Email</label>
              <div className="relative">
                <motion.span
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
                >
                  <Mail className="h-5 w-5" />
                </motion.span>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@email.com"
                  required
                  autoComplete="email"
                  className="pl-10 h-12 rounded-xl border-slate-600 bg-slate-900/50 text-slate-100 placeholder:text-slate-500 focus:ring-2 focus:ring-primary/50 focus:border-primary"
                />
              </div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5, type: 'spring', stiffness: 80 }}
              whileFocusWithin={{ scale: 1.01 }}
            >
              <label className="block text-sm font-medium text-slate-200 mb-2">Contraseña</label>
              <div className="relative">
                <motion.span
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 2, repeat: Infinity, repeatDelay: 3, delay: 0.5 }}
                >
                  <Lock className="h-5 w-5" />
                </motion.span>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                  className="pl-10 h-12 rounded-xl border-slate-600 bg-slate-900/50 text-slate-100 placeholder:text-slate-500 focus:ring-2 focus:ring-primary/50 focus:border-primary"
                />
              </div>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, type: 'spring', stiffness: 100 }}
            className="mt-6"
          >
            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Button
                type="submit"
                className="w-full h-12 rounded-xl font-semibold text-base bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/25 transition-all hover:shadow-primary/40"
                disabled={submitting || isLoading}
              >
                {submitting ? 'Entrando...' : 'Iniciar sesión'}
              </Button>
            </motion.div>
          </motion.div>
        </motion.form>
      </motion.div>
    </div>
  );
}
