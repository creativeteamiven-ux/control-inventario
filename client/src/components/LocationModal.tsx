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

export interface LocationItem {
  id: string;
  code: string;
  name: string;
  sortOrder: number;
}

interface LocationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  location: LocationItem | null;
  defaultSortOrder?: number;
}

export default function LocationModal({ open, onOpenChange, location, defaultSortOrder = 0 }: LocationModalProps) {
  const queryClient = useQueryClient();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ name: '', sortOrder: 0 });

  const isEdit = !!location;

  useEffect(() => {
    if (location) {
      setForm({ name: location.name, sortOrder: location.sortOrder });
    } else {
      setForm({ name: '', sortOrder: defaultSortOrder });
    }
  }, [location, defaultSortOrder]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error('El nombre es obligatorio');
      return;
    }
    setSubmitting(true);
    try {
      if (isEdit) {
        await api.patch(`/api/locations/${location!.id}`, {
          name: form.name.trim(),
          sortOrder: form.sortOrder,
        });
        queryClient.invalidateQueries({ queryKey: ['locations'] });
        toast.success('Lugar actualizado');
      } else {
        await api.post('/api/locations', {
          name: form.name.trim(),
          sortOrder: form.sortOrder,
        });
        queryClient.invalidateQueries({ queryKey: ['locations'] });
        toast.success('Lugar agregado');
      }
      onOpenChange(false);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Error al guardar';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar lugar' : 'Agregar lugar'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {isEdit && (
            <div>
              <label className="block text-sm font-medium mb-1.5 text-muted">Código (no editable)</label>
              <Input value={location?.code ?? ''} disabled className="bg-muted/50" />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium mb-1.5 text-foreground">Nombre *</label>
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Ej: Auditorio principal"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5 text-foreground">Orden</label>
            <Input
              type="number"
              min={0}
              value={form.sortOrder}
              onChange={(e) => setForm((f) => ({ ...f, sortOrder: parseInt(e.target.value, 10) || 0 }))}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? (isEdit ? 'Guardando...' : 'Agregando...') : (isEdit ? 'Guardar' : 'Agregar')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
