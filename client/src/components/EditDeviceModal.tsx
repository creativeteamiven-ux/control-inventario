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
import { usePermissions } from '@/hooks/usePermissions';

/** Parsea precio en formato colombiano: 5.000 = 5000, 1.500.000 = 1500000 */
function parsePriceCOP(value: string): number | undefined {
  const trimmed = value.trim().replace(/\s/g, '');
  if (!trimmed) return undefined;
  const withoutThousands = trimmed.replace(/\./g, '').replace(',', '.');
  const num = parseFloat(withoutThousands);
  return Number.isNaN(num) ? undefined : num;
}

const STATUS_OPTIONS = [
  { value: 'ACTIVE', label: 'Operativo' },
  { value: 'MAINTENANCE', label: 'En mantenimiento' },
  { value: 'DAMAGED', label: 'Dañado' },
  { value: 'LOST', label: 'Extraviado' },
  { value: 'RETIRED', label: 'Dado de baja' },
  { value: 'LOANED', label: 'En préstamo' },
];

const LOCATION_OPTIONS = [
  { value: 'MAIN_AUDITORIUM', label: 'Auditorio principal' },
  { value: 'RECORDING_STUDIO', label: 'Estudio de grabación' },
  { value: 'STORAGE_ROOM', label: 'Cuarto de almacenamiento' },
  { value: 'YOUTH_ROOM', label: 'Salón de jóvenes' },
  { value: 'CHAPEL', label: 'Capilla' },
  { value: 'ON_LOAN', label: 'En préstamo' },
];

interface Device {
  id: string;
  name: string;
  brand: string;
  model: string;
  serialNumber?: string | null;
  categoryId: string;
  status: string;
  location: string;
  purchasePrice?: number | string | null;
  supplier?: string | null;
  notes?: string | null;
  observation?: string | null;
  condition: number;
}

interface EditDeviceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  device: Device | null;
}

export default function EditDeviceModal({ open, onOpenChange, device }: EditDeviceModalProps) {
  const queryClient = useQueryClient();
  const { canViewCost } = usePermissions();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: '',
    brand: '',
    model: '',
    serialNumber: '',
    categoryId: '',
    status: 'ACTIVE',
    location: 'STORAGE_ROOM',
    purchasePrice: '',
    supplier: '',
    notes: '',
    observation: '',
    condition: '100',
  });

  useEffect(() => {
    if (device) {
      setForm({
        name: device.name,
        brand: device.brand,
        model: device.model,
        serialNumber: device.serialNumber || '',
        categoryId: device.categoryId,
        status: device.status,
        location: device.location,
        purchasePrice: device.purchasePrice != null ? String(device.purchasePrice) : '',
        supplier: device.supplier || '',
        notes: device.notes || '',
        observation: device.observation || '',
        condition: String(device.condition ?? 100),
      });
    }
  }, [device]);

  const { data: categoriesData, isLoading: categoriesLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data } = await api.get('/api/categories');
      return data;
    },
    enabled: open,
  });

  function flattenCats(cats: { id: string; name: string; children?: unknown[] }[], prefix = ''): { id: string; name: string }[] {
    const out: { id: string; name: string }[] = [];
    for (const c of cats) {
      const label = prefix ? `${prefix} › ${c.name}` : c.name;
      out.push({ id: c.id, name: label });
      const kids = c.children as { id: string; name: string; children?: unknown[] }[] | undefined;
      if (kids?.length) {
        out.push(...flattenCats(kids, prefix ? `${prefix} › ${c.name}` : c.name));
      }
    }
    return out;
  }
  const categories = Array.isArray(categoriesData) ? flattenCats(categoriesData) : [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!device) return;
    if (!form.name.trim() || !form.brand.trim() || !form.model.trim() || !form.categoryId) {
      toast.error('Nombre, Marca, Modelo y Categoría son obligatorios');
      return;
    }
    setSubmitting(true);
    try {
      await api.patch(`/api/devices/${device.id}`, {
        name: form.name.trim(),
        brand: form.brand.trim(),
        model: form.model.trim(),
        serialNumber: form.serialNumber.trim() || undefined,
        categoryId: form.categoryId,
        status: form.status,
        location: form.location,
        ...(canViewCost() && { purchasePrice: parsePriceCOP(form.purchasePrice) }),
        supplier: form.supplier.trim() || undefined,
        notes: form.notes.trim() || undefined,
        observation: form.observation.trim() || undefined,
        condition: Math.min(100, Math.max(0, parseInt(form.condition, 10) || 100)),
      });
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      queryClient.invalidateQueries({ queryKey: ['device', device.id] });
      toast.success('Equipo actualizado correctamente');
      onOpenChange(false);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Error al actualizar';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (!device) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar equipo</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Nombre *</label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Behringer X32"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Marca *</label>
              <Input
                value={form.brand}
                onChange={(e) => setForm({ ...form, brand: e.target.value })}
                placeholder="Behringer"
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Modelo *</label>
              <Input
                value={form.model}
                onChange={(e) => setForm({ ...form, model: e.target.value })}
                placeholder="X32"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Número de serie</label>
              <Input
                value={form.serialNumber}
                onChange={(e) => setForm({ ...form, serialNumber: e.target.value })}
                placeholder="Opcional"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Categoría *</label>
            <select
              value={form.categoryId}
              onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
              required
              disabled={categoriesLoading}
              className="flex h-10 w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="">{categoriesLoading ? 'Cargando...' : 'Seleccionar...'}</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
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
            <div>
              <label className="block text-sm font-medium mb-1.5">Ubicación</label>
              <select
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                className="flex h-10 w-full rounded-md border border-border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {LOCATION_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {canViewCost() && (
            <div>
              <label className="block text-sm font-medium mb-1.5">Precio de compra (COP)</label>
              <Input
                type="number"
                step="1"
                min={0}
                value={form.purchasePrice}
                onChange={(e) => setForm({ ...form, purchasePrice: e.target.value })}
                placeholder="Valor en pesos colombianos"
              />
            </div>
            )}
            <div>
              <label className="block text-sm font-medium mb-1.5">Condición (0-100)</label>
              <Input
                type="number"
                min={0}
                max={100}
                value={form.condition}
                onChange={(e) => setForm({ ...form, condition: e.target.value })}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Proveedor</label>
            <Input
              value={form.supplier}
              onChange={(e) => setForm({ ...form, supplier: e.target.value })}
              placeholder="Opcional"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Observación / Novedad</label>
            <Input
              value={form.observation}
              onChange={(e) => setForm({ ...form, observation: e.target.value })}
              placeholder="Ej: enviar a mantenimiento, cable dañado..."
              maxLength={500}
            />
            <p className="text-xs text-muted mt-1">Si el equipo funciona pero tiene una novedad o debe revisarse, indícalo aquí.</p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Notas</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Opcional"
              rows={2}
              className="flex w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary resize-none"
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
