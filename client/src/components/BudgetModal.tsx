import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';
import { EXPENSE_CATEGORIES, CURRENCIES } from '@/lib/expenseLabels';

export interface BudgetItem {
  id: string;
  year: number;
  month?: number | null;
  category?: string | null;
  amount: number | string;
  currency: string;
  note?: string | null;
}

interface BudgetModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  budget?: BudgetItem | null;
}

const MONTHS = [
  { value: '', label: 'Anual (todo el año)' },
  { value: '1', label: 'Enero' }, { value: '2', label: 'Febrero' }, { value: '3', label: 'Marzo' },
  { value: '4', label: 'Abril' }, { value: '5', label: 'Mayo' }, { value: '6', label: 'Junio' },
  { value: '7', label: 'Julio' }, { value: '8', label: 'Agosto' }, { value: '9', label: 'Septiembre' },
  { value: '10', label: 'Octubre' }, { value: '11', label: 'Noviembre' }, { value: '12', label: 'Diciembre' },
];

export default function BudgetModal({ open, onOpenChange, budget }: BudgetModalProps) {
  const queryClient = useQueryClient();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    year: String(new Date().getFullYear()),
    month: '',
    category: '',
    amount: '',
    currency: 'COP',
    note: '',
  });

  useEffect(() => {
    if (open) {
      if (budget) {
        setForm({
          year: String(budget.year),
          month: budget.month != null ? String(budget.month) : '',
          category: budget.category ?? '',
          amount: String(budget.amount ?? ''),
          currency: budget.currency || 'COP',
          note: budget.note ?? '',
        });
      } else {
        setForm({ year: String(new Date().getFullYear()), month: '', category: '', amount: '', currency: 'COP', note: '' });
      }
    }
  }, [open, budget]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(form.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error('Ingresa un monto válido mayor a 0');
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        year: Number(form.year),
        month: form.month ? Number(form.month) : null,
        category: form.category || null,
        amount,
        currency: form.currency,
        note: form.note.trim() || null,
      };
      if (budget) {
        await api.patch(`/api/budgets/${budget.id}`, payload);
        toast.success('Presupuesto actualizado');
      } else {
        await api.post('/api/budgets', payload);
        toast.success('Presupuesto creado');
      }
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      onOpenChange(false);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Error al guardar';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{budget ? 'Editar presupuesto' : 'Nuevo presupuesto'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Año *</label>
              <Input type="number" min="2000" max="2100" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} required />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Período</label>
              <select
                value={form.month}
                onChange={(e) => setForm({ ...form, month: e.target.value })}
                className="flex h-10 w-full rounded-md border border-border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {MONTHS.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Categoría</label>
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="flex h-10 w-full rounded-md border border-border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">Todas las categorías</option>
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Monto *</label>
              <Input type="number" step="0.01" min="0" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0" required />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Moneda</label>
              <select
                value={form.currency}
                onChange={(e) => setForm({ ...form, currency: e.target.value })}
                className="flex h-10 w-full rounded-md border border-border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {CURRENCIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Nota</label>
            <Input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Opcional" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={submitting}>{submitting ? 'Guardando...' : budget ? 'Guardar cambios' : 'Crear presupuesto'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
