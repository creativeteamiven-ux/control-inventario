import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
import { Paperclip, X } from 'lucide-react';
import { EXPENSE_CATEGORIES, CURRENCIES } from '@/lib/expenseLabels';

export interface ExpenseItem {
  id: string;
  date: string;
  amount: number | string;
  currency: string;
  category: string;
  description: string;
  supplier?: string | null;
  invoiceNumber?: string | null;
  paymentMethod?: string | null;
  deviceId?: string | null;
  receiptUrl?: string | null;
}

interface ExpenseModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expense?: ExpenseItem | null;
}

const EMPTY = {
  date: new Date().toISOString().slice(0, 10),
  amount: '',
  currency: 'COP',
  category: 'PURCHASE',
  description: '',
  supplier: '',
  invoiceNumber: '',
  paymentMethod: '',
  deviceId: '',
  receiptUrl: '',
};

export default function ExpenseModal({ open, onOpenChange, expense }: ExpenseModalProps) {
  const queryClient = useQueryClient();
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState(EMPTY);

  useEffect(() => {
    if (open) {
      if (expense) {
        setForm({
          date: expense.date ? new Date(expense.date).toISOString().slice(0, 10) : EMPTY.date,
          amount: String(expense.amount ?? ''),
          currency: expense.currency || 'COP',
          category: expense.category || 'OTHER',
          description: expense.description || '',
          supplier: expense.supplier || '',
          invoiceNumber: expense.invoiceNumber || '',
          paymentMethod: expense.paymentMethod || '',
          deviceId: expense.deviceId || '',
          receiptUrl: expense.receiptUrl || '',
        });
      } else {
        setForm(EMPTY);
      }
    }
  }, [open, expense]);

  const { data: devicesData } = useQuery({
    queryKey: ['devices', 'list'],
    queryFn: async () => {
      const { data } = await api.get('/api/devices', { params: { limit: 500 } });
      return data;
    },
    enabled: open,
  });
  const devices = devicesData?.devices ?? [];

  const handleReceipt = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('receipt', file);
      const { data } = await api.post<{ url: string }>('/api/upload/receipt', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setForm((f) => ({ ...f, receiptUrl: data.url }));
      toast.success('Comprobante adjuntado');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Error al subir el comprobante';
      toast.error(msg);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(form.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error('Ingresa un monto válido mayor a 0');
      return;
    }
    if (!form.description.trim()) {
      toast.error('La descripción es obligatoria');
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        date: form.date,
        amount,
        currency: form.currency,
        category: form.category,
        description: form.description.trim(),
        supplier: form.supplier.trim() || undefined,
        invoiceNumber: form.invoiceNumber.trim() || undefined,
        paymentMethod: form.paymentMethod.trim() || undefined,
        deviceId: form.deviceId || null,
        receiptUrl: form.receiptUrl || null,
      };
      if (expense) {
        await api.patch(`/api/expenses/${expense.id}`, payload);
        toast.success('Gasto actualizado');
      } else {
        await api.post('/api/expenses', payload);
        toast.success('Gasto registrado');
      }
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      onOpenChange(false);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Error al guardar el gasto';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{expense ? 'Editar gasto' : 'Registrar gasto'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Fecha *</label>
              <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Categoría</label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="flex h-10 w-full rounded-md border border-border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {EXPENSE_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
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
            <label className="block text-sm font-medium mb-1.5">Descripción *</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              required
              rows={2}
              placeholder="¿En qué fue el gasto?"
              className="flex w-full rounded-md border border-border bg-card px-3 py-2 text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Proveedor</label>
              <Input value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} placeholder="Nombre del proveedor" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">N° factura</label>
              <Input value={form.invoiceNumber} onChange={(e) => setForm({ ...form, invoiceNumber: e.target.value })} placeholder="Ej: FAC-001" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Método de pago</label>
              <Input value={form.paymentMethod} onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })} placeholder="Efectivo, transferencia..." />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Equipo asociado</label>
              <select
                value={form.deviceId}
                onChange={(e) => setForm({ ...form, deviceId: e.target.value })}
                className="flex h-10 w-full rounded-md border border-border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">(Ninguno)</option>
                {devices.map((d: { id: string; name: string; internalCode: string }) => (
                  <option key={d.id} value={d.id}>{d.internalCode} — {d.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Comprobante (foto o PDF)</label>
            {form.receiptUrl ? (
              <div className="flex items-center gap-2 text-sm">
                <a href={form.receiptUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-primary hover:underline">
                  <Paperclip className="h-4 w-4" /> Ver comprobante
                </a>
                <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => setForm({ ...form, receiptUrl: '' })}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <Input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={handleReceipt} disabled={uploading} />
            )}
            {uploading && <p className="text-xs text-muted mt-1">Subiendo...</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={submitting || uploading}>
              {submitting ? 'Guardando...' : expense ? 'Guardar cambios' : 'Registrar gasto'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
