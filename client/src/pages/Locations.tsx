import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { MapPin, Pencil, Plus, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import LocationModal, { type LocationItem } from '@/components/LocationModal';
import { useAuth } from '@/hooks/useAuth';
import toast from 'react-hot-toast';

export default function Locations() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const canEdit = user?.role === 'ADMIN' || user?.role === 'MANAGER';
  const [modalOpen, setModalOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<LocationItem | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['locations'],
    queryFn: async () => {
      const { data } = await api.get('/api/locations');
      return data;
    },
  });

  const locations = (data ?? []) as LocationItem[];

  function openAdd() {
    setEditingLocation(null);
    setModalOpen(true);
  }

  function openEdit(loc: LocationItem) {
    setEditingLocation(loc);
    setModalOpen(true);
  }

  async function handleDelete(loc: LocationItem) {
    if (!confirm(`¿Eliminar el lugar "${loc.name}"? Esta acción no se puede deshacer.`)) return;
    setDeletingId(loc.id);
    try {
      await api.delete(`/api/locations/${loc.id}`);
      queryClient.invalidateQueries({ queryKey: ['locations'] });
      toast.success('Lugar eliminado');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Error al eliminar';
      toast.error(msg);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Lugares</h1>
          <p className="text-muted mt-1 text-sm">
            Configura los nombres y el orden de las ubicaciones donde pueden estar los equipos (auditorio, almacén, etc.).
          </p>
        </div>
        {canEdit && (
          <Button onClick={openAdd} className="shrink-0">
            <Plus className="h-4 w-4 mr-2" />
            Agregar lugar
          </Button>
        )}
      </div>
      {isLoading ? (
        <div className="bg-card rounded-xl border border-border p-12 text-center text-muted">
          Cargando lugares...
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <ul className="divide-y divide-border">
            {locations.map((loc) => (
              <li
                key={loc.id}
                className="flex items-center gap-4 p-4 hover:bg-card-hover/30 transition-colors"
              >
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <MapPin className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground">{loc.name}</p>
                  <p className="text-sm text-muted font-mono">{loc.code}</p>
                </div>
                <span className="text-sm text-muted shrink-0">Orden: {loc.sortOrder}</span>
                {canEdit && (
                  <>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="shrink-0 min-h-touch min-w-touch md:min-h-0 md:min-w-0"
                      onClick={() => openEdit(loc)}
                      aria-label="Editar lugar"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="shrink-0 min-h-touch min-w-touch md:min-h-0 md:min-w-0 text-muted hover:text-destructive"
                      onClick={() => handleDelete(loc)}
                      disabled={deletingId === loc.id}
                      aria-label="Eliminar lugar"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </li>
            ))}
          </ul>
          {locations.length === 0 && (
            <div className="p-12 text-center text-muted">
              No hay lugares configurados. Ejecuta el seed o contacta al administrador.
            </div>
          )}
        </div>
      )}
      <LocationModal
        open={modalOpen}
        onOpenChange={(open) => {
          setModalOpen(open);
          if (!open) setEditingLocation(null);
        }}
        location={editingLocation}
        defaultSortOrder={locations.length}
      />
    </motion.div>
  );
}
