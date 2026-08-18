import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { FolderTree, Plus, Pencil, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import CategoryModal from '@/components/CategoryModal';
import { usePermissions } from '@/hooks/usePermissions';
import toast from 'react-hot-toast';

interface Cat {
  id: string;
  name: string;
  slug: string;
  icon?: string;
  color: string;
  parentId?: string | null;
  _count?: { devices: number };
  children?: Cat[];
}

export default function Categories() {
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const canEdit = hasPermission('categories.edit');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Cat | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data } = await api.get('/api/categories');
      return data;
    },
  });

  const categories = (data ?? []) as Cat[];

  function openAdd() {
    setEditingCategory(null);
    setModalOpen(true);
  }

  function openEdit(cat: Cat) {
    setEditingCategory(cat);
    setModalOpen(true);
  }

  async function handleDelete(cat: Cat) {
    if (!confirm(`¿Eliminar la categoría "${cat.name}"? Esta acción no se puede deshacer.`)) return;
    setDeletingId(cat.id);
    try {
      await api.delete(`/api/categories/${cat.id}`);
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      toast.success('Categoría eliminada');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Error al eliminar';
      toast.error(msg);
    } finally {
      setDeletingId(null);
    }
  }

  function renderCategory(cat: Cat, depth = 0) {
    const deviceCount = cat._count?.devices ?? 0;
    return (
      <div key={cat.id}>
        <div
          className="p-4 flex items-center gap-4 hover:bg-card-hover/50 transition-colors"
          style={{ paddingLeft: `${16 + depth * 20}px` }}
        >
          <div
            className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0"
            style={{ backgroundColor: `${cat.color}20` }}
          >
            <FolderTree className="h-5 w-5" style={{ color: cat.color }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium">{cat.name}</p>
            <p className="text-sm text-muted">{deviceCount} equipo{deviceCount !== 1 ? 's' : ''}</p>
          </div>
          {canEdit && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0"
                onClick={() => openEdit(cat)}
                aria-label="Editar categoría"
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0 text-muted hover:text-destructive"
                onClick={() => handleDelete(cat)}
                disabled={deletingId === cat.id}
                aria-label="Eliminar categoría"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
        {cat.children?.map((child) => renderCategory(child, depth + 1))}
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-display text-2xl font-bold text-foreground">Categorías</h1>
        {canEdit && (
          <Button onClick={openAdd}>
            <Plus className="h-4 w-4 mr-2" />
            Agregar categoría
          </Button>
        )}
      </div>
      {isLoading ? (
        <div className="bg-card rounded-xl border border-border p-12 text-center text-muted">
          Cargando categorías...
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border divide-y divide-border">
          {categories.map((cat) => renderCategory(cat))}
        </div>
      )}
      <CategoryModal
        open={modalOpen}
        onOpenChange={(open) => {
          setModalOpen(open);
          if (!open) setEditingCategory(null);
        }}
        category={editingCategory}
      />
    </motion.div>
  );
}
