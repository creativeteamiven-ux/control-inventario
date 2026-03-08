import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Package, Wrench, HandCoins, DollarSign, AlertTriangle, Eye, EyeOff } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis } from 'recharts';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { deviceStatusLabel } from '@/lib/statusLabels';
import { usePermissions } from '@/hooks/usePermissions';
import { Button } from '@/components/ui/button';

const DASHBOARD_VISIBILITY_KEY = 'dashboard-visibility';

const KPI_IDS = ['total', 'operativos', 'mantenimiento', 'prestamo', 'valor'] as const;
type KpiId = (typeof KPI_IDS)[number];

function getStoredVisibility(): Record<string, boolean> {
  const defaults: Record<string, boolean> = {
    category: true,
    status: true,
    alerts: true,
    ...Object.fromEntries(KPI_IDS.map((id) => [`kpi_${id}`, true])),
  };
  try {
    const s = localStorage.getItem(DASHBOARD_VISIBILITY_KEY);
    if (s) {
      const v = JSON.parse(s) as Record<string, boolean>;
      return { ...defaults, ...v };
    }
  } catch {
    /* ignore */
  }
  return defaults;
}

function storeVisibility(v: Record<string, boolean>) {
  try {
    localStorage.setItem(DASHBOARD_VISIBILITY_KEY, JSON.stringify(v));
  } catch {
    /* ignore */
  }
}

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: '#10B981',
  MAINTENANCE: '#F59E0B',
  LOANED: '#3B82F6',
  DAMAGED: '#EF4444',
  LOST: '#6B7280',
  RETIRED: '#64748B',
};

export default function Dashboard() {
  const { canViewCost } = usePermissions();
  const [visible, setVisible] = useState(() => getStoredVisibility());

  const toggle = (key: string) => {
    setVisible((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      storeVisibility(next);
      return next;
    });
  };

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const { data } = await api.get('/api/dashboard/stats');
      return data;
    },
    refetchInterval: 30000,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="font-display text-2xl font-bold text-foreground">Dashboard</h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-24 rounded-xl bg-card animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const kpis: { id: KpiId; label: string; value: string | number; icon: typeof Package; color: string }[] = [
    { id: 'total', label: 'Total equipos', value: data?.total ?? 0, icon: Package, color: 'text-primary' },
    { id: 'operativos', label: 'Operativos', value: data?.active ?? 0, icon: Package, color: 'text-green-500' },
    { id: 'mantenimiento', label: 'En mantenimiento', value: data?.maintenance ?? 0, icon: Wrench, color: 'text-amber-500' },
    { id: 'prestamo', label: 'En préstamo', value: data?.loaned ?? 0, icon: HandCoins, color: 'text-blue-500' },
    ...(canViewCost() ? [{ id: 'valor' as const, label: 'Valor inventario', value: `$${(data?.totalValue ?? 0).toLocaleString()}`, icon: DollarSign, color: 'text-foreground' }] : []),
  ];

  const pieData = (data?.byCategory ?? []).map((c: { categoryName: string; count: number; color: string }) => ({
    name: c.categoryName,
    value: c.count,
    color: c.color,
  }));

  const barData = (data?.byStatus ?? []).map((s: { status: string; count: number }) => ({
    name: deviceStatusLabel(s.status),
    count: s.count,
    fill: STATUS_COLORS[s.status] || '#64748B',
  }));

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      <h1 className="font-display text-2xl font-bold text-foreground">Dashboard</h1>

      <div>
        <h2 className="font-display font-semibold text-lg mb-4">Resumen</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {kpis.map((kpi, i) => {
            const key = `kpi_${kpi.id}`;
            const isVisible = visible[key] !== false;
            return (
              <motion.div
                key={kpi.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className={cn(
                  'bg-card rounded-xl border border-border transition-colors relative',
                  isVisible ? 'p-4 hover:border-primary/50' : 'p-3 flex items-center justify-between min-h-[72px]'
                )}
              >
                {isVisible ? (
                  <>
                    <div className="flex items-center gap-3 pr-8">
                      <div className={cn('p-2 rounded-lg bg-card-hover', kpi.color)}>
                        <kpi.icon className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-sm text-muted">{kpi.label}</p>
                        <p className="text-xl font-bold text-foreground">{kpi.value}</p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute top-2 right-2 min-h-touch min-w-touch md:min-h-0 md:min-w-0 md:h-8 md:w-8 text-muted hover:text-foreground"
                      onClick={() => toggle(key)}
                      title="Ocultar tarjeta"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-muted truncate">{kpi.label}</p>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0 text-muted hover:text-foreground"
                      onClick={() => toggle(key)}
                      title="Mostrar tarjeta"
                    >
                      <EyeOff className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 overflow-x-hidden">
        <div className="bg-card rounded-xl border border-border p-4 md:p-6 min-w-0">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-semibold text-lg">Distribución por categoría</h2>
            <Button
              variant="ghost"
              size="icon"
              className="min-h-touch min-w-touch md:min-h-0 md:min-w-0 text-muted hover:text-foreground"
              onClick={() => toggle('category')}
              title={visible.category ? 'Ocultar gráfica' : 'Mostrar gráfica'}
            >
              {visible.category ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
            </Button>
          </div>
          {visible.category && (
            <div className="h-56 sm:h-64 overflow-x-auto">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={2} dataKey="value">
                    {pieData.map((entry: { color: string }, i: number) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
        <div className="bg-card rounded-xl border border-border p-4 md:p-6 min-w-0">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-semibold text-lg">Equipos por estado</h2>
            <Button
              variant="ghost"
              size="icon"
              className="min-h-touch min-w-touch md:min-h-0 md:min-w-0 text-muted hover:text-foreground"
              onClick={() => toggle('status')}
              title={visible.status ? 'Ocultar gráfica' : 'Mostrar gráfica'}
            >
              {visible.status ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
            </Button>
          </div>
          {visible.status && (
            <div className="h-56 sm:h-64 overflow-x-auto">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData} layout="vertical" margin={{ left: 60 }}>
                  <XAxis type="number" stroke="#64748B" tick={{ fontSize: 12 }} />
                  <YAxis type="category" dataKey="name" stroke="#64748B" width={60} tick={{ fontSize: 12 }} />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border p-4 md:p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
            <h2 className="font-display font-semibold text-lg">Alertas activas</h2>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="min-h-touch min-w-touch md:min-h-0 md:min-w-0 text-muted hover:text-foreground"
            onClick={() => toggle('alerts')}
            title={visible.alerts ? 'Ocultar sección' : 'Mostrar sección'}
          >
            {visible.alerts ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
          </Button>
        </div>
        {visible.alerts && (
          <p className="text-muted text-sm">Las alertas de garantías próximas a vencer y préstamos vencidos se mostrarán aquí.</p>
        )}
      </div>
    </motion.div>
  );
}
