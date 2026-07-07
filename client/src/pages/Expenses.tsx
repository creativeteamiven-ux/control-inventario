import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Receipt, Plus, Pencil, Trash2, Paperclip, Download } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { usePermissions } from '@/hooks/usePermissions';
import { EXPENSE_CATEGORIES, expenseCategoryLabel, formatMoney } from '@/lib/expenseLabels';
import ExpenseModal, { ExpenseItem } from '@/components/ExpenseModal';

interface ExpenseRow extends ExpenseItem {
  amount: number | string;
  device?: { id: string; name: string; internalCode: string } | null;
}

interface StatsResponse {
  count: number;
  byCurrency: Record<string, number>;
  byCategory: Record<string, Record<string, number>>;
  byMonth: Record<string, Record<string, number>>;
}

export default function Expenses() {
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const canManage = hasPermission('finance.manage');
  const canExport = hasPermission('finance.export');

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ExpenseItem | null>(null);
  const [filters, setFilters] = useState({ from: '', to: '', category: '', currency: '' });

  const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));

  const { data: expenses = [], isLoading } = useQuery<ExpenseRow[]>({
    queryKey: ['expenses', params],
    queryFn: async () => {
      const { data } = await api.get('/api/expenses', { params });
      return data;
    },
  });

  const { data: stats } = useQuery<StatsResponse>({
    queryKey: ['expenses', 'stats', params],
    queryFn: async () => {
      const { data } = await api.get('/api/expenses/stats', { params });
      return data;
    },
  });

  const { data: valuation } = useQuery<{
    deviceCount: number;
    totalPurchase: number;
    totalBookValue: number;
    totalDepreciation: number;
    byCategory: { name: string; purchase: number; bookValue: number; count: number }[];
  }>({
    queryKey: ['reports', 'financial'],
    queryFn: async () => {
      const { data } = await api.get('/api/reports/financial');
      return data;
    },
  });

  const handleDelete = async (id: string) => {
    if (!window.confirm('¿Eliminar este gasto? Esta acción no se puede deshacer.')) return;
    try {
      await api.delete(`/api/expenses/${id}`);
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      toast.success('Gasto eliminado');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Error al eliminar';
      toast.error(msg);
    }
  };

  const exportExcel = async () => {
    try {
      const { data } = await api.get('/api/expenses/export', { params, responseType: 'blob' });
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'gastos-thewarehouse.xlsx';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Error al exportar');
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex flex-col gap-4">
        <h1 className="font-display text-2xl font-bold text-foreground">Gastos</h1>
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap sm:items-center gap-2">
          {canExport && (
            <Button variant="outline" onClick={exportExcel} className="min-h-touch sm:min-h-0">
              <Download className="h-4 w-4 mr-2 shrink-0" />
              <span className="truncate">Exportar Excel</span>
            </Button>
          )}
          {canManage && (
            <Button onClick={() => { setEditing(null); setModalOpen(true); }} className="col-span-2 min-h-touch sm:col-span-1 sm:min-h-0">
              <Plus className="h-4 w-4 mr-2 shrink-0" />
              Registrar gasto
            </Button>
          )}
        </div>
      </div>

      {/* Totales por moneda */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {stats && Object.entries(stats.byCurrency).length > 0 ? (
          Object.entries(stats.byCurrency).map(([cur, total]) => (
            <div key={cur} className="bg-card rounded-xl border border-border p-4">
              <p className="text-sm text-muted">Total gastado ({cur})</p>
              <p className="text-2xl font-bold text-foreground mt-1">{formatMoney(total, cur)}</p>
            </div>
          ))
        ) : (
          <div className="bg-card rounded-xl border border-border p-4">
            <p className="text-sm text-muted">Total gastado</p>
            <p className="text-2xl font-bold text-foreground mt-1">—</p>
          </div>
        )}
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-sm text-muted">N° de gastos</p>
          <p className="text-2xl font-bold text-foreground mt-1">{stats?.count ?? 0}</p>
        </div>
      </div>

      {/* Reportes financieros: desglose por categoría + valoración del inventario */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-card rounded-xl border border-border p-4">
          <h2 className="font-display font-semibold mb-3">Gastos por categoría</h2>
          {stats && Object.keys(stats.byCategory).length > 0 ? (
            <ul className="space-y-2">
              {Object.entries(stats.byCategory).map(([cat, byCur]) => (
                <li key={cat} className="flex items-center justify-between gap-2 text-sm">
                  <span className="text-muted">{expenseCategoryLabel(cat)}</span>
                  <span className="font-medium text-foreground text-right">
                    {Object.entries(byCur).map(([cur, total]) => formatMoney(total, cur)).join(' · ')}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">Sin datos para el rango seleccionado.</p>
          )}
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <h2 className="font-display font-semibold mb-3">Valor del inventario (COP)</h2>
          {valuation ? (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted">Valor de compra ({valuation.deviceCount} equipos)</span><span className="font-medium">{formatMoney(valuation.totalPurchase, 'COP')}</span></div>
              <div className="flex justify-between"><span className="text-muted">Valor en libros (actual)</span><span className="font-medium text-green-600">{formatMoney(valuation.totalBookValue, 'COP')}</span></div>
              <div className="flex justify-between"><span className="text-muted">Depreciación acumulada</span><span className="font-medium text-amber-500">{formatMoney(valuation.totalDepreciation, 'COP')}</span></div>
            </div>
          ) : (
            <p className="text-sm text-muted">Cargando...</p>
          )}
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-card rounded-xl border border-border p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div>
          <label className="block text-xs font-medium text-muted mb-1">Desde</label>
          <Input type="date" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted mb-1">Hasta</label>
          <Input type="date" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted mb-1">Categoría</label>
          <select
            value={filters.category}
            onChange={(e) => setFilters({ ...filters, category: e.target.value })}
            className="flex h-10 w-full rounded-md border border-border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">Todas</option>
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-muted mb-1">Moneda</label>
          <select
            value={filters.currency}
            onChange={(e) => setFilters({ ...filters, currency: e.target.value })}
            className="flex h-10 w-full rounded-md border border-border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">Todas</option>
            <option value="COP">COP</option>
            <option value="USD">USD</option>
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="bg-card rounded-xl border border-border p-12 text-center text-muted">Cargando...</div>
      ) : (
        <>
          {/* Móvil: cards */}
          <div className="md:hidden space-y-3">
            {expenses.length === 0 ? (
              <div className="bg-card rounded-xl border border-border p-12 text-center text-muted flex flex-col items-center gap-2">
                <Receipt className="h-12 w-12" />
                <p>No hay gastos registrados</p>
              </div>
            ) : (
              expenses.map((e) => (
                <div key={e.id} className="bg-card rounded-xl border border-border p-4 flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-foreground leading-tight">{e.description}</p>
                      <p className="text-xs text-muted">{expenseCategoryLabel(e.category)}</p>
                    </div>
                    <span className="shrink-0 font-bold text-foreground">{formatMoney(Number(e.amount), e.currency)}</span>
                  </div>
                  <dl className="grid gap-1.5 text-sm">
                    <div className="flex justify-between gap-2">
                      <dt className="text-muted">Fecha</dt>
                      <dd className="text-foreground">{format(new Date(e.date), 'dd MMM yyyy', { locale: es })}</dd>
                    </div>
                    {e.supplier && (
                      <div className="flex justify-between gap-2">
                        <dt className="text-muted">Proveedor</dt>
                        <dd className="text-foreground">{e.supplier}</dd>
                      </div>
                    )}
                    {e.device && (
                      <div className="flex justify-between gap-2">
                        <dt className="text-muted">Equipo</dt>
                        <dd className="text-foreground">{e.device.internalCode}</dd>
                      </div>
                    )}
                  </dl>
                  <div className="flex items-center gap-2">
                    {e.receiptUrl && (
                      <a href={e.receiptUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-sm text-primary hover:underline">
                        <Paperclip className="h-4 w-4" /> Comprobante
                      </a>
                    )}
                    {canManage && (
                      <div className="ml-auto flex gap-1">
                        <Button variant="outline" size="sm" onClick={() => { setEditing(e); setModalOpen(true); }}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handleDelete(e.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Desktop: tabla */}
          <div className="hidden md:block bg-card rounded-xl border border-border overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-4 px-4 font-medium text-muted">Fecha</th>
                  <th className="text-left py-4 px-4 font-medium text-muted">Descripción</th>
                  <th className="text-left py-4 px-4 font-medium text-muted">Categoría</th>
                  <th className="text-left py-4 px-4 font-medium text-muted">Proveedor</th>
                  <th className="text-left py-4 px-4 font-medium text-muted">Equipo</th>
                  <th className="text-right py-4 px-4 font-medium text-muted">Monto</th>
                  <th className="w-24"></th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((e) => (
                  <tr key={e.id} className="border-b border-border hover:bg-card-hover/50">
                    <td className="py-3 px-4 text-sm">{format(new Date(e.date), 'dd MMM yyyy', { locale: es })}</td>
                    <td className="py-3 px-4">
                      <p className="font-medium">{e.description}</p>
                      {e.invoiceNumber && <p className="text-xs text-muted">Factura: {e.invoiceNumber}</p>}
                    </td>
                    <td className="py-3 px-4 text-sm">{expenseCategoryLabel(e.category)}</td>
                    <td className="py-3 px-4 text-sm">{e.supplier || '—'}</td>
                    <td className="py-3 px-4 text-sm">{e.device?.internalCode || '—'}</td>
                    <td className="py-3 px-4 text-right font-medium">{formatMoney(Number(e.amount), e.currency)}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-end gap-1">
                        {e.receiptUrl && (
                          <a href={e.receiptUrl} target="_blank" rel="noreferrer" title="Ver comprobante" className="p-2 text-muted hover:text-primary">
                            <Paperclip className="h-4 w-4" />
                          </a>
                        )}
                        {canManage && (
                          <>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted hover:text-primary" onClick={() => { setEditing(e); setModalOpen(true); }} title="Editar">
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted hover:text-destructive" onClick={() => handleDelete(e.id)} title="Eliminar">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {expenses.length === 0 && (
              <div className="p-12 text-center text-muted flex flex-col items-center gap-2">
                <Receipt className="h-12 w-12" />
                <p>No hay gastos registrados</p>
              </div>
            )}
          </div>
        </>
      )}

      <ExpenseModal
        open={modalOpen}
        onOpenChange={(o) => { setModalOpen(o); if (!o) setEditing(null); }}
        expense={editing}
      />
    </motion.div>
  );
}
