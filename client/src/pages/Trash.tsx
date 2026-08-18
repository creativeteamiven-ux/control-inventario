import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Trash2, RotateCcw, Package } from 'lucide-react';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { useLocations } from '@/hooks/useLocations';
import { deviceStatusLabel } from '@/lib/statusLabels';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface TrashDevice {
  id: string;
  name: string;
  internalCode: string;
  brand: string;
  model: string;
  status: string;
  location: string;
  deletedAt: string;
  category?: { name: string } | null;
}

export default function Trash() {
  const queryClient = useQueryClient();
  const { label } = useLocations();
  const [busyId, setBusyId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['devices-trash'],
    queryFn: async () => {
      const { data } = await api.get<{ devices: TrashDevice[]; total: number }>('/api/devices/trash');
      return data;
    },
  });

  const devices = data?.devices ?? [];

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['devices-trash'] });
    queryClient.invalidateQueries({ queryKey: ['devices'] });
    queryClient.invalidateQueries({ queryKey: ['categories'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
  };

  const restore = async (d: TrashDevice) => {
    if (!confirm(`¿Restaurar "${d.name}" (${d.internalCode}) al inventario?`)) return;
    setBusyId(d.id);
    try {
      await api.post(`/api/devices/${d.id}/restore`);
      invalidate();
      toast.success('Equipo restaurado');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Error al restaurar';
      toast.error(msg);
    } finally {
      setBusyId(null);
    }
  };

  const permanent = async (d: TrashDevice) => {
    if (!confirm(`¿Borrar definitivamente "${d.name}"?\n\nSe eliminarán también sus movimientos, mantenimientos y préstamos. No se puede deshacer.`)) return;
    setBusyId(d.id);
    try {
      await api.delete(`/api/devices/${d.id}/permanent`);
      invalidate();
      toast.success('Equipo eliminado de forma permanente');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Error al eliminar';
      toast.error(msg);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">Papelera</h1>
        <p className="text-sm text-muted mt-1">
          Equipos dados de baja. Puedes restaurarlos al inventario o borrarlos del todo.
        </p>
      </div>

      {isLoading ? (
        <div className="bg-card rounded-xl border border-border p-12 text-center text-muted">Cargando...</div>
      ) : devices.length === 0 ? (
        <div className="bg-card rounded-xl border border-border p-12 text-center text-muted flex flex-col items-center gap-2">
          <Package className="h-12 w-12 opacity-40" />
          <p>La papelera está vacía.</p>
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <ul className="divide-y divide-border">
            {devices.map((d) => (
              <li key={d.id} className="flex flex-col sm:flex-row sm:items-center gap-3 p-4">
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{d.name}</p>
                  <p className="text-sm text-muted font-mono">{d.internalCode}</p>
                  <p className="text-xs text-muted mt-1">
                    {d.category?.name ?? 'Sin categoría'} · {deviceStatusLabel(d.status)} · {label(d.location)}
                    {d.deletedAt && (
                      <> · Baja {format(new Date(d.deletedAt), 'dd MMM yyyy', { locale: es })}</>
                    )}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button variant="outline" size="sm" onClick={() => restore(d)} disabled={busyId === d.id}>
                    <RotateCcw className="h-4 w-4 mr-2" /> Restaurar
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted hover:text-destructive"
                    onClick={() => permanent(d)}
                    disabled={busyId === d.id}
                  >
                    <Trash2 className="h-4 w-4 mr-2" /> Borrar del todo
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </motion.div>
  );
}
