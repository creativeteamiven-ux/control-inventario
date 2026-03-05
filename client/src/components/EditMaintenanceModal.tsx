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
import { usePermissions } from '@/hooks/usePermissions';

const TYPE_OPTIONS = [
  { value: 'preventivo', label: 'Preventivo' },
  { value: 'correctivo', label: 'Correctivo' },
  { value: 'calibración', label: 'Calibración' },
];

const STATUS_OPTIONS = [
  { value: 'SCHEDULED', label: 'Programado' },
  { value: 'IN_PROGRESS', label: 'En progreso' },
  { value: 'COMPLETED', label: 'Completado' },
];

interface Maintenance {
  id: string;
  deviceId: string;
  type: string;
  description: string;
  cost?: number | null;
  technician?: string | null;
  startDate: string;
  endDate?: string | null;
  status: string;
  notes?: string | null;
  device?: { name: string; internalCode: string };
}

interface EditMaintenanceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  maintenance: Maintenance | null;
}

function toDateInput(d: string | Date | null | undefined): string {
  if (!d) return '';
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toISOString().slice(0, 10);
}

export default function EditMaintenanceModal({ open, onOpenChange, maintenance }: EditMaintenanceModalProps) {
  const queryClient = useQueryClient();
  const { canViewCost } = usePermissions();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    type: 'preventivo',
    description: '',
    cost: '',
    technician: '',
    startDate: '',
    endDate: '',
    status: 'SCHEDULED',
    notes: '',
  });

  useEffect(() => {
    if (maintenance) {
      setForm({
        type: maintenance.type || 'preventivo',
        description: maintenance.description || '',
        cost: maintenance.cost != null ? String(maintenance.cost) : '',
        technician: maintenance.technician || '',
        startDate: toDateInput(maintenance.startDate),
        endDate: toDateInput(maintenance.endDate),
        status: maintenance.status || 'SCHEDULED',
        notes: maintenance.notes || '',
      });
    }
  }, [maintenance, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!maintenance) return;
    if (!form.description.trim()) {
      toast.error('La descripción es obligatoria');
      return;
    }
    if (!form.startDate) {
      toast.error('La fecha de inicio es obligatoria');
      return;
    }
    setSubmitting(true);
    try {
      await api.patch(`/api/maintenance/${maintenance.id}`, {
        type: form.type,
        description: form.description.trim(),
        ...(canViewCost() && { cost: form.cost ? parseFloat(form.cost) : undefined }),
        technician: form.technician.trim() || undefined,
        startDate: form.startDate,
        endDate: form.endDate || undefined,
        status: form.status,
        notes: form.notes.trim() || undefined,
      });
      queryClient.invalidateQueries({ queryKey: ['maintenance'] });
      queryClient.invalidateQueries({ queryKey: ['device', maintenance.deviceId] });
      toast.success('Mantenimiento actualizado');
      onOpenChange(false);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Error al actualizar';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (!maintenance) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar mantenimiento</DialogTitle>
          {maintenance.device && (
            <p className="text-sm text-muted mt-1">
              {maintenance.device.name} ({maintenance.device.internalCode})
            </p>
          )}
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Tipo</label>
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
              className="flex h-10 w-full rounded-md border border-border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Descripción *</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              required
              rows={3}
              className="flex w-full rounded-md border border-border bg-card px-3 py-2 text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Fecha inicio *</label>
              <Input
                type="date"
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Fecha fin</label>
              <Input
                type="date"
                value={form.endDate}
                onChange={(e) => setForm({ ...form, endDate: e.target.value })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Estado</label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="flex h-10 w-full rounded-md border border-border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            {canViewCost() && (
            <div>
              <label className="block text-sm font-medium mb-1.5">Costo</label>
              <Input
                type="number"
                step="0.01"
                value={form.cost}
                onChange={(e) => setForm({ ...form, cost: e.target.value })}
                placeholder="0"
              />
            </div>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Técnico</label>
            <Input
              value={form.technician}
              onChange={(e) => setForm({ ...form, technician: e.target.value })}
              placeholder="Nombre del técnico"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Notas</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2}
              className="flex w-full rounded-md border border-border bg-card px-3 py-2 text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Guardando...' : 'Guardar cambios'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
