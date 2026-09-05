import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { CalendarDays, Plus, ClipboardList, ChevronRight, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { setBuildEventId } from '@/lib/eventBuild';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import LocationSelect from '@/components/LocationSelect';
import DevicePickerModal from '@/components/DevicePickerModal';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/hooks/useAuth';
import { useLocations } from '@/hooks/useLocations';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';

interface EventSummary {
  id: string;
  name: string;
  eventDate: string;
  fromLocation: string;
  toLocation: string;
  fromLocationLabel?: string;
  toLocationLabel?: string;
  toLocationIsTemporary?: boolean;
  status: 'DRAFT' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  currentPhase: 'OUTBOUND' | 'INBOUND';
  stats: { total: number; outboundDone: number; inboundDone: number };
}

const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Borrador',
  ACTIVE: 'En curso',
  COMPLETED: 'Completado',
  CANCELLED: 'Cancelado',
};

const STATUS_STYLE: Record<string, string> = {
  DRAFT: 'bg-slate-500/20 text-slate-400',
  ACTIVE: 'bg-primary/20 text-primary',
  COMPLETED: 'bg-green-500/20 text-green-400',
  CANCELLED: 'bg-red-500/20 text-red-400',
};

export default function Events() {
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const { user } = useAuth();
  const { label: locationLabel } = useLocations();
  const canManage = hasPermission('events.manage');
  const isAdmin = user?.role === 'ADMIN';

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [eventDate, setEventDate] = useState(() => new Date().toISOString().slice(0, 16));
  const [fromLocation, setFromLocation] = useState('STORAGE_ROOM');
  const [destType, setDestType] = useState<'registered' | 'custom'>('registered');
  const [toLocation, setToLocation] = useState('MAIN_AUDITORIUM');
  const [toLocationCustom, setToLocationCustom] = useState('');
  const [notes, setNotes] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedDevices, setSelectedDevices] = useState<{ id: string; internalCode: string; name: string }[]>([]);
  const [creating, setCreating] = useState(false);
  const [filter, setFilter] = useState('');

  const { data: events = [], isLoading } = useQuery({
    queryKey: ['events', filter],
    queryFn: async () => {
      const { data } = await api.get<EventSummary[]>('/api/events', {
        params: filter ? { status: filter } : {},
      });
      return data;
    },
  });

  const resetForm = () => {
    setName('');
    setEventDate(new Date().toISOString().slice(0, 16));
    setFromLocation('STORAGE_ROOM');
    setDestType('registered');
    setToLocation('MAIN_AUDITORIUM');
    setToLocationCustom('');
    setNotes('');
    setSelectedDevices([]);
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error('Indica el nombre del evento');
      return;
    }
    if (destType === 'custom' && !toLocationCustom.trim()) {
      toast.error('Indica el nombre del lugar del evento (ej. Teatro Municipal)');
      return;
    }
    setCreating(true);
    try {
      const { data } = await api.post('/api/events', {
        name: name.trim(),
        eventDate,
        fromLocation,
        ...(destType === 'custom'
          ? { toLocationCustom: toLocationCustom.trim() }
          : { toLocation }),
        notes: notes.trim() || undefined,
        deviceIds: selectedDevices.map((d) => d.id),
      });
      await queryClient.invalidateQueries({ queryKey: ['events'] });
      toast.success('Evento creado. Escanea los equipos para armar la lista.');
      setCreateOpen(false);
      resetForm();
      setBuildEventId(data.id);
      window.location.href = `/events/${data.id}`;
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
        || (err as { response?: { status?: number } })?.response?.status === 403
          ? 'Sin permiso para crear eventos. Cierra sesión y vuelve a entrar, o pide a un admin que active "Gestionar eventos".'
          : 'Error al crear';
      toast.error(msg);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (e: EventSummary) => {
    if (!isAdmin) {
      toast.error('Solo un administrador puede eliminar eventos');
      return;
    }
    if (!confirm(`¿Eliminar el evento "${e.name}"? Esta acción no se puede deshacer.`)) return;
    try {
      await api.delete(`/api/events/${e.id}`);
      await queryClient.invalidateQueries({ queryKey: ['events'] });
      toast.success('Evento eliminado');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Error al eliminar';
      toast.error(msg);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
            <CalendarDays className="h-7 w-7 text-primary" /> Eventos
          </h1>
          <p className="text-sm text-muted mt-1">
            Listas de equipos con checklist de salida y regreso por escaneo de código de barras.
          </p>
        </div>
        {canManage && (
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-2" /> Nuevo evento
          </Button>
        )}
      </div>

      <div className="flex gap-2 flex-wrap">
        {['', 'DRAFT', 'ACTIVE', 'COMPLETED'].map((s) => (
          <Button
            key={s || 'all'}
            variant={filter === s ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter(s)}
          >
            {s ? STATUS_LABEL[s] : 'Todos'}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <p className="text-muted text-center py-12">Cargando eventos...</p>
      ) : events.length === 0 ? (
        <div className="text-center py-16 bg-card rounded-xl border border-border">
          <ClipboardList className="h-12 w-12 text-muted mx-auto mb-3" />
          <p className="text-muted">No hay eventos {filter ? STATUS_LABEL[filter]?.toLowerCase() : ''}</p>
          {canManage && (
            <Button className="mt-4" onClick={() => setCreateOpen(true)}>
              Crear primer evento
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-3">
          {events.map((e) => (
            <Link
              key={e.id}
              to={`/events/${e.id}`}
              className="flex items-center gap-4 p-4 bg-card rounded-xl border border-border hover:border-primary/40 transition-colors group"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', STATUS_STYLE[e.status])}>
                    {STATUS_LABEL[e.status]}
                  </span>
                  {e.status === 'ACTIVE' && (
                    <span
                      className={cn(
                        'text-xs font-medium px-2 py-0.5 rounded-full',
                        e.currentPhase === 'OUTBOUND'
                          ? 'bg-primary/15 text-primary'
                          : 'bg-emerald-500/15 text-emerald-300'
                      )}
                    >
                      {e.currentPhase === 'OUTBOUND' ? 'Salida' : 'Devolución'}
                    </span>
                  )}
                </div>
                <h2 className="font-semibold text-lg mt-1 truncate">{e.name}</h2>
                <p className="text-sm text-muted">
                  {format(new Date(e.eventDate), "d MMM yyyy, HH:mm", { locale: es })} ·{' '}
                  {(e.fromLocationLabel ?? locationLabel(e.fromLocation))} →{' '}
                  {(e.toLocationLabel ?? locationLabel(e.toLocation))}
                  {e.toLocationIsTemporary && (
                    <span className="text-primary/80"> (temporal)</span>
                  )}
                </p>
                {e.stats.total > 0 && (
                  <p className="text-xs text-muted mt-1">
                    {typeof (e as { listCount?: number }).listCount === 'number'
                      ? `${(e as { listCount?: number }).listCount} lista(s) · `
                      : ''}
                    {e.stats.total} equipos · Salida {e.stats.outboundDone}/{e.stats.total} · Regreso{' '}
                    {e.stats.inboundDone}/{e.stats.total}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {canManage && e.status === 'DRAFT' && (
                  <Button variant="outline" size="sm" asChild>
                    <Link
                      to={`/scan?mode=event&eventId=${e.id}`}
                      onClick={(ev) => {
                        ev.stopPropagation();
                        setBuildEventId(e.id);
                      }}
                    >
                      Escanear
                    </Link>
                  </Button>
                )}
                {isAdmin && e.status !== 'ACTIVE' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    title="Eliminar evento (solo admin)"
                    onClick={(ev) => {
                      ev.preventDefault();
                      void handleDelete(e);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
                <ChevronRight className="h-5 w-5 text-muted group-hover:text-primary" />
              </div>
            </Link>
          ))}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nuevo evento</DialogTitle>
            <DialogDescription>
              Define el evento, el origen de los equipos y el destino (habitual o temporal).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-muted block mb-1">Nombre del evento</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Culto dominical" />
            </div>
            <div>
              <label className="text-sm text-muted block mb-1">Fecha y hora</label>
              <Input type="datetime-local" value={eventDate} onChange={(e) => setEventDate(e.target.value)} />
            </div>
            <div className="grid grid-cols-1 gap-3">
              <div>
                <label className="text-sm text-muted block mb-1">Origen (de dónde salen los equipos)</label>
                <LocationSelect value={fromLocation} onChange={setFromLocation} />
              </div>
              <div>
                <label className="text-sm text-muted block mb-2">Destino (dónde es el evento)</label>
                <div className="flex gap-2 mb-2">
                  <Button
                    type="button"
                    variant={destType === 'registered' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setDestType('registered')}
                  >
                    Lugar habitual
                  </Button>
                  <Button
                    type="button"
                    variant={destType === 'custom' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setDestType('custom')}
                  >
                    Lugar temporal
                  </Button>
                </div>
                {destType === 'registered' ? (
                  <LocationSelect value={toLocation} onChange={setToLocation} />
                ) : (
                  <div className="space-y-1">
                    <Input
                      value={toLocationCustom}
                      onChange={(e) => setToLocationCustom(e.target.value)}
                      placeholder="Ej. Teatro Municipal, Parque Simón Bolívar..."
                    />
                    <p className="text-xs text-muted">
                      No hace falta crear este lugar en el sistema. Solo se usa para este evento.
                    </p>
                  </div>
                )}
              </div>
            </div>
            <div>
              <label className="text-sm text-muted block mb-1">Notas (opcional)</label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Detalles del evento..." />
            </div>
            <div>
              <label className="text-sm text-muted block mb-1">Equipos</label>
              <p className="text-xs text-muted mb-2">
                Después de crear el evento, escanea los equipos en la ficha del evento o en Escanear → Armar evento.
              </p>
              {selectedDevices.length > 0 && (
                <>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-muted">Preseleccionados ({selectedDevices.length})</span>
                    <Button type="button" variant="ghost" size="sm" onClick={() => setPickerOpen(true)}>
                      <Plus className="h-4 w-4 mr-1" /> Agregar manual
                    </Button>
                  </div>
                  <ul className="text-sm border border-border rounded-md divide-y divide-border max-h-32 overflow-y-auto">
                    {selectedDevices.map((d) => (
                      <li key={d.id} className="px-3 py-2 flex justify-between gap-2">
                        <span className="truncate">{d.name}</span>
                        <span className="font-mono text-xs text-primary shrink-0">{d.internalCode}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {selectedDevices.length === 0 && (
                <Button type="button" variant="outline" size="sm" onClick={() => setPickerOpen(true)}>
                  <Plus className="h-4 w-4 mr-1" /> Agregar manual (opcional)
                </Button>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating ? 'Creando...' : 'Crear evento'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DevicePickerModal
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        cartIds={selectedDevices.map((d) => d.id)}
        onAdd={(devices) => setSelectedDevices((prev) => [...prev, ...devices.filter((d) => !prev.some((p) => p.id === d.id))])}
      />
    </motion.div>
  );
}
