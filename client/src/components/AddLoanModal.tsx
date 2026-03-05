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

interface AddLoanModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function AddLoanModal({ open, onOpenChange }: AddLoanModalProps) {
  const queryClient = useQueryClient();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    deviceId: '',
    borrowerName: '',
    borrowerEmail: '',
    borrowerPhone: '',
    purpose: '',
    loanDate: new Date().toISOString().slice(0, 10),
    expectedReturn: '',
    notes: '',
  });

  const { data: devicesData } = useQuery({
    queryKey: ['devices', 'list'],
    queryFn: async () => {
      const { data } = await api.get('/api/devices', { params: { limit: 500 } });
      return data;
    },
    enabled: open,
  });

  const devices = (devicesData?.devices ?? []).filter(
    (d: { status?: string }) => d.status !== 'LOANED'
  );

  useEffect(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (open && !form.expectedReturn) {
      setForm((f) => ({ ...f, expectedReturn: tomorrow.toISOString().slice(0, 10) }));
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.deviceId) {
      toast.error('Selecciona un equipo');
      return;
    }
    if (!form.borrowerName.trim()) {
      toast.error('El nombre del prestatario es obligatorio');
      return;
    }
    if (!form.purpose.trim()) {
      toast.error('El propósito es obligatorio');
      return;
    }
    if (!form.loanDate || !form.expectedReturn) {
      toast.error('Fechas de préstamo y devolución son obligatorias');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/api/loans', {
        deviceId: form.deviceId,
        borrowerName: form.borrowerName.trim(),
        borrowerEmail: form.borrowerEmail.trim() || undefined,
        borrowerPhone: form.borrowerPhone.trim() || undefined,
        purpose: form.purpose.trim(),
        loanDate: form.loanDate,
        expectedReturn: form.expectedReturn,
        notes: form.notes.trim() || undefined,
      });
      queryClient.invalidateQueries({ queryKey: ['loans'] });
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      toast.success('Préstamo registrado');
      setForm({
        deviceId: '',
        borrowerName: '',
        borrowerEmail: '',
        borrowerPhone: '',
        purpose: '',
        loanDate: new Date().toISOString().slice(0, 10),
        expectedReturn: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
        notes: '',
      });
      onOpenChange(false);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Error al registrar';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Agregar préstamo</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Equipo *</label>
            <select
              value={form.deviceId}
              onChange={(e) => setForm({ ...form, deviceId: e.target.value })}
              required
              className="flex h-10 w-full rounded-md border border-border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">Seleccionar equipo...</option>
              {devices.map((d: { id: string; name: string; internalCode: string; status?: string }) => (
                <option key={d.id} value={d.id}>
                  {d.internalCode} — {d.name}
                </option>
              ))}
              {devices.length === 0 && (
                <option value="" disabled>
                  No hay equipos disponibles (todos están en préstamo)
                </option>
              )}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Prestatario *</label>
            <Input
              value={form.borrowerName}
              onChange={(e) => setForm({ ...form, borrowerName: e.target.value })}
              placeholder="Nombre completo"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Email</label>
              <Input
                type="email"
                value={form.borrowerEmail}
                onChange={(e) => setForm({ ...form, borrowerEmail: e.target.value })}
                placeholder="email@ejemplo.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Teléfono</label>
              <Input
                value={form.borrowerPhone}
                onChange={(e) => setForm({ ...form, borrowerPhone: e.target.value })}
                placeholder="Opcional"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Propósito *</label>
            <Input
              value={form.purpose}
              onChange={(e) => setForm({ ...form, purpose: e.target.value })}
              placeholder="Ej: Grabación, evento, etc."
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Fecha préstamo *</label>
              <Input
                type="date"
                value={form.loanDate}
                onChange={(e) => setForm({ ...form, loanDate: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Devolución esperada *</label>
              <Input
                type="date"
                value={form.expectedReturn}
                onChange={(e) => setForm({ ...form, expectedReturn: e.target.value })}
                required
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Notas</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2}
              placeholder="Notas adicionales"
              className="flex w-full rounded-md border border-border bg-card px-3 py-2 text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Guardando...' : 'Agregar préstamo'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
