import { useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ShieldCheck, ChevronLeft, ChevronRight } from 'lucide-react';
import { api } from '@/lib/api';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const ACTION_LABELS: Record<string, string> = {
  CREATE: 'Creó',
  UPDATE: 'Actualizó',
  DELETE: 'Eliminó',
  LOGIN: 'Inició sesión',
  RETURN: 'Devolvió',
  STATUS_CHANGE: 'Cambió estado',
};

const ACTION_BADGE: Record<string, string> = {
  CREATE: 'bg-green-500/20 text-green-400',
  UPDATE: 'bg-blue-500/20 text-blue-400',
  DELETE: 'bg-red-500/20 text-red-400',
  LOGIN: 'bg-slate-500/20 text-slate-400',
  RETURN: 'bg-amber-500/20 text-amber-400',
  STATUS_CHANGE: 'bg-purple-500/20 text-purple-400',
};

const ENTITY_LABELS: Record<string, string> = {
  Device: 'Equipo',
  User: 'Usuario',
  Maintenance: 'Mantenimiento',
  LoanRecord: 'Préstamo',
  Movement: 'Movimiento',
  Category: 'Categoría',
  Expense: 'Gasto',
  Budget: 'Presupuesto',
};

interface AuditItem {
  id: string;
  entity: string;
  entityId: string;
  action: string;
  changes?: unknown;
  userEmail?: string | null;
  ipAddress?: string | null;
  createdAt: string;
}

export default function Audit() {
  const [filters, setFilters] = useState({ entity: '', action: '', userEmail: '', from: '', to: '' });
  const [page, setPage] = useState(1);
  const limit = 50;

  const { data, isLoading } = useQuery({
    queryKey: ['audit', filters, page],
    queryFn: async () => {
      const params = { ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)), page, limit };
      const { data } = await api.get('/api/audit', { params });
      return data;
    },
    placeholderData: keepPreviousData,
  });

  const items: AuditItem[] = data?.items ?? [];
  const total: number = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  const setFilter = (key: string, value: string) => {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(1);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex items-center gap-3">
        <ShieldCheck className="h-6 w-6 text-primary" />
        <h1 className="font-display text-2xl font-bold text-foreground">Registro de auditoría</h1>
      </div>
      <p className="text-sm text-muted -mt-3">Historial de acciones: quién hizo qué y cuándo.</p>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div>
          <label className="block text-xs font-medium text-muted mb-1">Acción</label>
          <select
            value={filters.action}
            onChange={(e) => setFilter('action', e.target.value)}
            className="flex h-10 w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">Todas</option>
            {Object.entries(ACTION_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-muted mb-1">Módulo</label>
          <select
            value={filters.entity}
            onChange={(e) => setFilter('entity', e.target.value)}
            className="flex h-10 w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">Todos</option>
            {Object.entries(ENTITY_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-muted mb-1">Usuario (correo)</label>
          <Input value={filters.userEmail} onChange={(e) => setFilter('userEmail', e.target.value)} placeholder="correo@..." />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted mb-1">Desde</label>
          <Input type="date" value={filters.from} onChange={(e) => setFilter('from', e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted mb-1">Hasta</label>
          <Input type="date" value={filters.to} onChange={(e) => setFilter('to', e.target.value)} />
        </div>
      </div>

      {isLoading ? (
        <div className="bg-card rounded-xl border border-border p-12 text-center text-muted">Cargando...</div>
      ) : (
        <div className="bg-card rounded-xl border border-border overflow-hidden overflow-x-auto">
          <table className="w-full min-w-[760px]">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-4 font-medium text-muted text-sm">Fecha</th>
                <th className="text-left py-3 px-4 font-medium text-muted text-sm">Usuario</th>
                <th className="text-left py-3 px-4 font-medium text-muted text-sm">Acción</th>
                <th className="text-left py-3 px-4 font-medium text-muted text-sm">Módulo</th>
                <th className="text-left py-3 px-4 font-medium text-muted text-sm">Detalle</th>
                <th className="text-left py-3 px-4 font-medium text-muted text-sm">IP</th>
              </tr>
            </thead>
            <tbody>
              {items.map((a) => (
                <tr key={a.id} className="border-b border-border hover:bg-card-hover/50 align-top">
                  <td className="py-3 px-4 text-sm whitespace-nowrap">{format(new Date(a.createdAt), 'dd MMM yyyy HH:mm', { locale: es })}</td>
                  <td className="py-3 px-4 text-sm">{a.userEmail || '—'}</td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-0.5 rounded text-xs ${ACTION_BADGE[a.action] ?? 'bg-muted/20'}`}>
                      {ACTION_LABELS[a.action] ?? a.action}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-sm">{ENTITY_LABELS[a.entity] ?? a.entity}</td>
                  <td className="py-3 px-4 text-xs text-muted max-w-[280px]">
                    <span className="font-mono">{a.entityId}</span>
                    {a.changes != null && (
                      <span className="block truncate text-muted/70" title={JSON.stringify(a.changes)}>
                        {JSON.stringify(a.changes)}
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-xs text-muted">{a.ipAddress || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {items.length === 0 && (
            <div className="p-12 text-center text-muted flex flex-col items-center gap-2">
              <ShieldCheck className="h-12 w-12" />
              <p>No hay registros que coincidan con los filtros</p>
            </div>
          )}
        </div>
      )}

      {total > limit && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted">{total} registro(s)</p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-muted">Página {page} de {totalPages}</span>
            <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </motion.div>
  );
}
