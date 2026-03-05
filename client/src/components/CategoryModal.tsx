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

const PRESET_COLORS = [
  '#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#06B6D4',
  '#6366F1', '#F43F5E', '#84CC16', '#EAB308',
];

const ICON_OPTIONS = [
  { value: 'folder-tree', label: 'Árbol de carpetas' },
  { value: 'music', label: 'Música' },
  { value: 'mic', label: 'Micrófono' },
  { value: 'speakers', label: 'Altavoces' },
  { value: 'cable', label: 'Cable' },
  { value: 'lightbulb', label: 'Bombilla' },
  { value: 'monitor', label: 'Pantalla' },
  { value: 'box', label: 'Caja' },
];

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[áàäâ]/g, 'a')
    .replace(/[éèëê]/g, 'e')
    .replace(/[íìïî]/g, 'i')
    .replace(/[óòöô]/g, 'o')
    .replace(/[úùüû]/g, 'u')
    .replace(/ñ/g, 'n')
    .replace(/[^a-z0-9-]/g, '');
}

interface Category {
  id: string;
  name: string;
  slug: string;
  icon: string;
  color: string;
  parentId?: string | null;
}

interface CategoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: Category | null;
}

export default function CategoryModal({ open, onOpenChange, category }: CategoryModalProps) {
  const queryClient = useQueryClient();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: '',
    slug: '',
    icon: 'folder-tree',
    color: '#3B82F6',
  });

  const isEdit = !!category;

  useEffect(() => {
    if (category) {
      setForm({
        name: category.name,
        slug: category.slug,
        icon: category.icon || 'folder-tree',
        color: category.color || '#3B82F6',
      });
    } else {
      setForm({
        name: '',
        slug: '',
        icon: 'folder-tree',
        color: '#3B82F6',
      });
    }
  }, [category, open]);

  const handleNameChange = (name: string) => {
    setForm((prev) => ({
      ...prev,
      name,
      slug: isEdit ? prev.slug : slugify(name),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error('El nombre es obligatorio');
      return;
    }
    const slug = form.slug.trim() || slugify(form.name);
    if (!/^[a-z0-9-]+$/.test(slug)) {
      toast.error('El slug debe contener solo letras minúsculas, números y guiones');
      return;
    }
    setSubmitting(true);
    try {
      if (isEdit && category) {
        await api.patch(`/api/categories/${category.id}`, {
          name: form.name.trim(),
          slug,
          icon: form.icon,
          color: form.color,
        });
        toast.success('Categoría actualizada');
      } else {
        await api.post('/api/categories', {
          name: form.name.trim(),
          slug,
          icon: form.icon,
          color: form.color,
        });
        toast.success('Categoría creada');
      }
      queryClient.invalidateQueries({ queryKey: ['categories'] });
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar categoría' : 'Agregar categoría'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Nombre *</label>
            <Input
              value={form.name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="Ej: Sistema PA"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Slug *</label>
            <Input
              value={form.slug}
              onChange={(e) => setForm({ ...form, slug: e.target.value })}
              placeholder="sistema-pa (se genera del nombre)"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Ícono</label>
            <select
              value={form.icon}
              onChange={(e) => setForm({ ...form, icon: e.target.value })}
              className="flex h-10 w-full rounded-md border border-border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {ICON_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Color</label>
            <div className="flex flex-wrap gap-2 mt-1">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setForm({ ...form, color: c })}
                  className={`h-8 w-8 rounded-full border-2 transition-all ${
                    form.color === c ? 'border-foreground scale-110' : 'border-transparent hover:scale-105'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
            <div className="flex items-center gap-2 mt-2">
              <Input
                type="color"
                value={form.color}
                onChange={(e) => setForm({ ...form, color: e.target.value })}
                className="h-10 w-14 p-1 cursor-pointer"
              />
              <Input
                value={form.color}
                onChange={(e) => setForm({ ...form, color: e.target.value })}
                placeholder="#3B82F6"
                className="font-mono text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Agregar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
