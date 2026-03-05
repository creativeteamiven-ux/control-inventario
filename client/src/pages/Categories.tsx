import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { FolderTree, Plus, Pencil } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import CategoryModal from '@/components/CategoryModal';

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
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Cat | null>(null);

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
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0"
            onClick={() => openEdit(cat)}
            aria-label="Editar categoría"
          >
            <Pencil className="h-4 w-4" />
          </Button>
        </div>
        {cat.children?.map((child) => renderCategory(child, depth + 1))}
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-display text-2xl font-bold text-foreground">Categorías</h1>
        <Button onClick={openAdd}>
          <Plus className="h-4 w-4 mr-2" />
          Agregar categoría
        </Button>
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
