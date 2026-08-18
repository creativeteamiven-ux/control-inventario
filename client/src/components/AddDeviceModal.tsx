import { useState, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ImagePlus, X } from 'lucide-react';
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
import LocationSelect from '@/components/LocationSelect';

const MAX_IMAGES = 5;

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

interface AddDeviceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function AddDeviceModal({ open, onOpenChange }: AddDeviceModalProps) {
  const queryClient = useQueryClient();
  const { canViewCost } = usePermissions();
  const [submitting, setSubmitting] = useState(false);
  const [images, setImages] = useState<File[]>([]);
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

  const { data: categoriesData, isLoading: categoriesLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data } = await api.get('/api/categories');
      return data;
    },
    enabled: open,
  });

  // Aplanar árbol de categorías (padres + hijos) para el select
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

  // Previsualizaciones locales de las imágenes seleccionadas (se liberan al cambiar/desmontar).
  const previews = useMemo(() => images.map((f) => URL.createObjectURL(f)), [images]);
  useEffect(() => () => previews.forEach((url) => URL.revokeObjectURL(url)), [previews]);

  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files || []);
    e.target.value = '';
    if (!picked.length) return;
    const valid = picked.filter((f) => /image\/(jpe?g|png|webp)/.test(f.type) && f.size <= 5 * 1024 * 1024);
    if (valid.length < picked.length) {
      toast.error('Solo imágenes JPG/PNG/WebP de máximo 5 MB');
    }
    setImages((prev) => {
      const combined = [...prev, ...valid];
      if (combined.length > MAX_IMAGES) toast.error(`Máximo ${MAX_IMAGES} imágenes`);
      return combined.slice(0, MAX_IMAGES);
    });
  };

  const removeImage = (idx: number) => setImages((prev) => prev.filter((_, i) => i !== idx));

  const resetForm = () => {
    setForm({ name: '', brand: '', model: '', serialNumber: '', categoryId: '', status: 'ACTIVE', location: 'STORAGE_ROOM', purchasePrice: '', supplier: '', notes: '', observation: '', condition: '100' });
    setImages([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.brand.trim() || !form.model.trim() || !form.categoryId) {
      toast.error('Nombre, Marca, Modelo y Categoría son obligatorios');
      return;
    }
    setSubmitting(true);
    try {
      const { data: created } = await api.post('/api/devices', {
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

      // Subir imágenes (si hay) y vincularlas al equipo recién creado.
      if (images.length > 0 && created?.id) {
        try {
          const fd = new FormData();
          images.forEach((f) => fd.append('images', f));
          fd.append('deviceId', created.id);
          await api.post('/api/upload/images', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
          queryClient.invalidateQueries({ queryKey: ['device', created.id] });
        } catch {
          toast.error('El equipo se creó, pero falló la subida de imágenes. Puedes agregarlas luego editando el equipo.');
        }
      }

      queryClient.invalidateQueries({ queryKey: ['devices'] });
      toast.success('Equipo agregado correctamente');
      resetForm();
      onOpenChange(false);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Error al agregar equipo';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Agregar equipo</DialogTitle>
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
            {!categoriesLoading && categories.length === 0 && (
              <p className="text-xs text-amber-500 mt-1">No hay categorías. Crea una en la sección Categorías.</p>
            )}
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
              <LocationSelect
                value={form.location}
                onChange={(location) => setForm({ ...form, location })}
              />
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
          <div>
            <label className="block text-sm font-medium mb-1.5">Imágenes del equipo</label>
            <div className="flex flex-wrap gap-3">
              {previews.map((src, i) => (
                <div key={src} className="relative h-20 w-20 rounded-md overflow-hidden border border-border group">
                  <img src={src} alt={`Imagen ${i + 1}`} className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removeImage(i)}
                    className="absolute top-0.5 right-0.5 rounded-full bg-black/60 p-0.5 text-white opacity-90 hover:bg-black/80"
                    aria-label="Quitar imagen"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              {images.length < MAX_IMAGES && (
                <label className="h-20 w-20 flex flex-col items-center justify-center gap-1 rounded-md border border-dashed border-border cursor-pointer text-muted hover:text-foreground hover:border-primary transition-colors">
                  <ImagePlus className="h-5 w-5" />
                  <span className="text-[10px]">Agregar</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    className="hidden"
                    onChange={handleFiles}
                  />
                </label>
              )}
            </div>
            <p className="text-xs text-muted mt-1">Hasta {MAX_IMAGES} imágenes (JPG, PNG o WebP, máx. 5 MB c/u). La primera será la principal.</p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? (images.length > 0 ? 'Guardando y subiendo...' : 'Guardando...') : 'Agregar equipo'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
