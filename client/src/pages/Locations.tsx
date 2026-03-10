import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { MapPin, Pencil, Plus } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import LocationModal, { type LocationItem } from '@/components/LocationModal';

export default function Locations() {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<LocationItem | null>(null);

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

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Lugares</h1>
          <p className="text-muted mt-1 text-sm">
            Configura los nombres y el orden de las ubicaciones donde pueden estar los equipos (auditorio, almacén, etc.).
          </p>
        </div>
        <Button onClick={openAdd} className="shrink-0">
          <Plus className="h-4 w-4 mr-2" />
          Agregar lugar
        </Button>
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
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0 min-h-touch min-w-touch md:min-h-0 md:min-w-0"
                  onClick={() => openEdit(loc)}
                  aria-label="Editar lugar"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
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
