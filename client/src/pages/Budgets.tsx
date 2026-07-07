import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { PiggyBank, Plus, Pencil, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { usePermissions } from '@/hooks/usePermissions';
import { expenseCategoryLabel, formatMoney } from '@/lib/expenseLabels';
import BudgetModal, { BudgetItem } from '@/components/BudgetModal';

interface BudgetRow extends BudgetItem {
  amount: number;
  spent: number;
  remaining: number;
  percentUsed: number;
}

const MONTH_NAMES = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

function periodLabel(b: BudgetRow): string {
  return b.month ? `${MONTH_NAMES[b.month]} ${b.year}` : `Año ${b.year}`;
}

export default function Budgets() {
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const canManage = hasPermission('finance.manage');

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<BudgetItem | null>(null);
  const [year, setYear] = useState(String(new Date().getFullYear()));

  const { data: budgets = [], isLoading } = useQuery<BudgetRow[]>({
    queryKey: ['budgets', year],
    queryFn: async () => {
      const { data } = await api.get('/api/budgets', { params: year ? { year } : {} });
      return data;
    },
  });

  const handleDelete = async (id: string) => {
    if (!window.confirm('¿Eliminar este presupuesto?')) return;
    try {
      await api.delete(`/api/budgets/${id}`);
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      toast.success('Presupuesto eliminado');
    } catch {
      toast.error('Error al eliminar');
    }
  };

  const barColor = (pct: number) => (pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-green-500');

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-display text-2xl font-bold text-foreground">Presupuestos</h1>
        <div className="flex items-center gap-2">
          <Input type="number" min="2000" max="2100" value={year} onChange={(e) => setYear(e.target.value)} className="w-28" placeholder="Año" />
          {canManage && (
            <Button onClick={() => { setEditing(null); setModalOpen(true); }} className="min-h-touch sm:min-h-0">
              <Plus className="h-4 w-4 mr-2 shrink-0" /> Nuevo
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="bg-card rounded-xl border border-border p-12 text-center text-muted">Cargando...</div>
      ) : budgets.length === 0 ? (
        <div className="bg-card rounded-xl border border-border p-12 text-center text-muted flex flex-col items-center gap-2">
          <PiggyBank className="h-12 w-12" />
          <p>No hay presupuestos para este año</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {budgets.map((b) => (
            <div key={b.id} className="bg-card rounded-xl border border-border p-4 flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-foreground">{periodLabel(b)}</p>
                  <p className="text-sm text-muted">{b.category ? expenseCategoryLabel(b.category) : 'Todas las categorías'} · {b.currency}</p>
                </div>
                {canManage && (
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted hover:text-primary" onClick={() => { setEditing(b); setModalOpen(true); }}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted hover:text-destructive" onClick={() => handleDelete(b.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-muted">Gastado: <strong className="text-foreground">{formatMoney(b.spent, b.currency)}</strong></span>
                  <span className="text-muted">de {formatMoney(b.amount, b.currency)}</span>
                </div>
                <div className="w-full h-2.5 bg-card-hover rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${barColor(b.percentUsed)}`} style={{ width: `${Math.min(100, b.percentUsed)}%` }} />
                </div>
                <div className="flex justify-between text-sm mt-1.5">
                  <span className={b.percentUsed >= 100 ? 'text-red-500 font-medium' : 'text-muted'}>{b.percentUsed}% usado</span>
                  <span className={b.remaining < 0 ? 'text-red-500 font-medium' : 'text-green-600'}>
                    {b.remaining < 0 ? 'Excedido ' : 'Disponible '}{formatMoney(Math.abs(b.remaining), b.currency)}
                  </span>
                </div>
              </div>
              {b.note && <p className="text-sm text-muted">{b.note}</p>}
            </div>
          ))}
        </div>
      )}

      <BudgetModal open={modalOpen} onOpenChange={(o) => { setModalOpen(o); if (!o) setEditing(null); }} budget={editing} />
    </motion.div>
  );
}
