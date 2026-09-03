import { useCallback, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  AlertTriangle,
  Package,
  Plus,
  Play,
  Truck,
  Home,
  Trash2,
  XCircle,
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import BarcodeScanner from '@/components/BarcodeScanner';
import DevicePickerModal from '@/components/DevicePickerModal';
import { usePermissions } from '@/hooks/usePermissions';
import { useLocations } from '@/hooks/useLocations';
import { cn } from '@/lib/utils';

interface EventItem {
  id: string;
  outboundScannedAt: string | null;
  inboundScannedAt: string | null;
  outboundUserName: string | null;
  inboundUserName: string | null;
  device: {
    id: string;
    name: string;
    internalCode: string;
    serialNumber: string | null;
    location: string;
    images?: { url: string }[];
  };
}

interface EventDetail {
  id: string;
  name: string;
  eventDate: string;
  fromLocation: string;
  toLocation: string;
  fromLocationLabel?: string;
  toLocationLabel?: string;
  toLocationIsTemporary?: boolean;
  status: string;
  currentPhase: 'OUTBOUND' | 'INBOUND';
  notes: string | null;
  items: EventItem[];
  stats: { total: number; outboundDone: number; inboundDone: number; outboundPending: number; inboundPending: number };
}

interface ScanResult {
  success: boolean;
  code: string;
  message: string;
  device?: { id: string; name: string; internalCode: string };
}

interface AddScanResult {
  success: boolean;
  code: string;
  message: string;
  device?: { id: string; name: string; internalCode: string };
  total?: number;
}

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const { label: locationLabel } = useLocations();
  const canManage = hasPermission('events.manage');
  const canScan = hasPermission('events.scan');

  const [pickerOpen, setPickerOpen] = useState(false);
  const [scanning, setScanning] = useState(canScan);
  const [addingScan, setAddingScan] = useState(true);
  const [lastScan, setLastScan] = useState<ScanResult | null>(null);
  const [lastAdded, setLastAdded] = useState<AddScanResult | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [activating, setActivating] = useState(false);
  const [filter, setFilter] = useState<'all' | 'pending' | 'done'>('all');

  const { data: event, isLoading } = useQuery({
    queryKey: ['event', id],
    queryFn: async () => {
      const { data } = await api.get<EventDetail>(`/api/events/${id}`);
      return data;
    },
    enabled: !!id,
    refetchInterval: (q) => (q.state.data?.status === 'ACTIVE' ? 5000 : false),
  });

  const phase = event?.currentPhase ?? 'OUTBOUND';
  const isActive = event?.status === 'ACTIVE';
  const isDraft = event?.status === 'DRAFT';

  const handleDraftAddScan = useCallback(
    async (code: string) => {
      if (!id || !isDraft) return;
      try {
        const { data } = await api.post<AddScanResult>(`/api/events/${id}/add-by-scan`, { code });
        setLastAdded(data);
        if (data.success) {
          toast.success(data.message, { duration: 1800 });
          await queryClient.invalidateQueries({ queryKey: ['event', id] });
          await queryClient.invalidateQueries({ queryKey: ['events'] });
        } else {
          toast.error(data.message);
        }
      } catch (err: unknown) {
        const res = (err as { response?: { data?: AddScanResult } })?.response?.data;
        toast.error(res?.message || 'No se pudo agregar el equipo');
      }
    },
    [id, isDraft, queryClient]
  );

  const handleScan = useCallback(
    async (code: string) => {
      if (!id || !canScan || !isActive) return;
      try {
        const { data } = await api.post<ScanResult>(`/api/events/${id}/scan`, { code, phase });
        setLastScan(data);
        if (data.success) {
          toast.success(data.message, { duration: 2000 });
          await queryClient.invalidateQueries({ queryKey: ['event', id] });
          await queryClient.invalidateQueries({ queryKey: ['events'] });
        } else {
          toast.error(data.message, { duration: 3500 });
        }
      } catch (err: unknown) {
        const res = (err as { response?: { data?: ScanResult } })?.response?.data;
        if (res) {
          setLastScan(res);
          toast.error(res.message, { duration: 3500 });
        } else {
          toast.error('Error al escanear');
        }
      }
    },
    [id, canScan, isActive, phase, queryClient]
  );

  const handleActivate = async () => {
    if (!id || !event) return;
    const originLabel = event.fromLocationLabel ?? locationLabel(event.fromLocation);
    const wrongLoc = event.items.filter((i) => i.device.location !== event.fromLocation);
    if (wrongLoc.length > 0) {
      const names = wrongLoc
        .slice(0, 5)
        .map((i) => `${i.device.internalCode} (${locationLabel(i.device.location)})`)
        .join(', ');
      const ok = confirm(
        `${wrongLoc.length} equipo(s) NO están en el origen "${originLabel}" según inventario:\n${names}${wrongLoc.length > 5 ? '…' : ''}\n\n` +
          `Al escanear la salida fallarán hasta que registres un traslado al origen, o cambies el origen del evento.\n\n¿Activar de todos modos?`
      );
      if (!ok) return;
    }
    setActivating(true);
    try {
      await api.post(`/api/events/${id}/activate`);
      await queryClient.invalidateQueries({ queryKey: ['event', id] });
      toast.success('Evento activado — ya pueden escanear');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Error';
      toast.error(msg);
    } finally {
      setActivating(false);
    }
  };

  const handleConfirm = async () => {
    if (!id || !event) return;
    const isOutbound = phase === 'OUTBOUND';
    const msg = isOutbound
      ? '¿Confirmar salida? Se registrarán los movimientos y los equipos pasarán al lugar del evento.'
      : '¿Confirmar regreso? Se registrarán los movimientos y los equipos volverán al origen.';
    if (!confirm(msg)) return;
    setConfirming(true);
    try {
      const endpoint = isOutbound ? 'confirm-outbound' : 'confirm-inbound';
      await api.post(`/api/events/${id}/${endpoint}`);
      await queryClient.invalidateQueries({ queryKey: ['event', id] });
      await queryClient.invalidateQueries({ queryKey: ['events'] });
      await queryClient.invalidateQueries({ queryKey: ['devices'] });
      toast.success(isOutbound ? 'Salida confirmada — fase de regreso iniciada' : 'Regreso confirmado — evento completado');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Error';
      toast.error(msg);
    } finally {
      setConfirming(false);
    }
  };

  const handleRemoveItem = async (itemId: string, name: string) => {
    if (!id || !confirm(`¿Quitar "${name}" de la lista?`)) return;
    try {
      await api.delete(`/api/events/${id}/items/${itemId}`);
      await queryClient.invalidateQueries({ queryKey: ['event', id] });
      toast.success('Equipo quitado');
    } catch {
      toast.error('No se pudo quitar');
    }
  };

  if (isLoading || !event) {
    return <div className="py-20 text-center text-muted">Cargando evento...</div>;
  }

  const progress = phase === 'OUTBOUND' ? event.stats.outboundDone : event.stats.inboundDone;
  const progressPct = event.stats.total ? Math.round((progress / event.stats.total) * 100) : 0;

  const filteredItems = event.items.filter((item) => {
    const done = phase === 'OUTBOUND' ? item.outboundScannedAt : item.inboundScannedAt;
    if (filter === 'pending') return !done;
    if (filter === 'done') return !!done;
    return true;
  });

  const fromLabel = event.fromLocationLabel ?? locationLabel(event.fromLocation);
  const toLabel = event.toLocationLabel ?? locationLabel(event.toLocation);
  const wrongOriginCount =
    isActive && phase === 'OUTBOUND'
      ? event.items.filter((i) => !i.outboundScannedAt && i.device.location !== event.fromLocation).length
      : 0;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-start gap-3">
        <Link to="/events" className="p-2 rounded-lg hover:bg-card-hover text-muted mt-1">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="font-display text-2xl font-bold truncate">{event.name}</h1>
          <p className="text-sm text-muted mt-1">
            {format(new Date(event.eventDate), "EEEE d MMM yyyy, HH:mm", { locale: es })}
          </p>
          <p className="text-sm text-muted">
            {fromLabel} → {toLabel}
            {event.toLocationIsTemporary && <span className="text-primary/80"> (lugar temporal)</span>}
          </p>
        </div>
      </div>

      {/* Borrador: escanear para armar la lista */}
      {isDraft && (canManage || canScan) && (
        <div className="bg-primary/5 border border-primary/30 rounded-xl p-4 space-y-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <h2 className="font-semibold text-lg">Escanea para agregar equipos</h2>
              <p className="text-sm text-muted mt-0.5">
                Apunta al código de barras de cada equipo. La lista se llena automáticamente ({event.items.length}{' '}
                equipos).
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setAddingScan((s) => !s)}>
              {addingScan ? 'Pausar' : 'Escanear'}
            </Button>
          </div>
          <BarcodeScanner readerId={`event-add-${id}`} active={addingScan} onScan={handleDraftAddScan} />
          {lastAdded?.device && (
            <div className="flex items-center gap-2 text-sm text-green-400 bg-green-500/10 border border-green-500/30 rounded-lg px-3 py-2">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>
                {lastAdded.message} · <span className="font-mono">{lastAdded.device.internalCode}</span>
                {lastAdded.total != null ? ` · Total: ${lastAdded.total}` : ''}
              </span>
            </div>
          )}
          {canManage && (
            <Button variant="outline" size="sm" onClick={() => setPickerOpen(true)} className="w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-1" /> Buscar manualmente (opcional)
            </Button>
          )}
        </div>
      )}

      {/* Progreso */}
      <div className="bg-card rounded-xl border border-border p-4 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <span className="font-medium">
            {phase === 'OUTBOUND' ? (
              <span className="flex items-center gap-2"><Truck className="h-4 w-4 text-primary" /> Checklist de salida</span>
            ) : (
              <span className="flex items-center gap-2"><Home className="h-4 w-4 text-primary" /> Checklist de regreso</span>
            )}
          </span>
          <span className="text-sm text-muted">
            {progress} / {event.stats.total} verificados ({progressPct}%)
          </span>
        </div>
        <div className="h-3 bg-card-hover rounded-full overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all duration-500', progressPct === 100 ? 'bg-green-500' : 'bg-primary')}
            style={{ width: `${progressPct}%` }}
          />
        </div>
        {isDraft && canManage && (
          <Button
            className="w-full min-h-touch"
            onClick={handleActivate}
            disabled={activating || event.items.length === 0}
          >
            <Play className="h-4 w-4 mr-2" />
            {activating
              ? 'Activando...'
              : event.items.length === 0
                ? 'Agrega equipos escaneando antes de activar'
                : `Activar evento (${event.items.length} equipos)`}
          </Button>
        )}
        {isActive && canManage && progressPct === 100 && (
          <Button className="w-full min-h-touch" onClick={handleConfirm} disabled={confirming}>
            {phase === 'OUTBOUND' ? (
              <><Truck className="h-4 w-4 mr-2" />{confirming ? 'Confirmando...' : 'Confirmar salida y trasladar equipos'}</>
            ) : (
              <><Home className="h-4 w-4 mr-2" />{confirming ? 'Confirmando...' : 'Confirmar regreso y guardar equipos'}</>
            )}
          </Button>
        )}
        {event.status === 'COMPLETED' && (
          <p className="text-sm text-green-400 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" /> Evento completado
          </p>
        )}
      </div>

      {/* Escáner + feedback */}
      {isActive && canScan && (
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-semibold">Escanear código de barras</h2>
              <Button variant="ghost" size="sm" onClick={() => setScanning((s) => !s)}>
                {scanning ? 'Pausar' : 'Reanudar'}
              </Button>
            </div>
            <BarcodeScanner readerId={`event-scanner-${id}`} active={scanning} onScan={handleScan} />
            <p className="text-xs text-muted mt-2 text-center">
              {phase === 'OUTBOUND'
                ? `Salida: el equipo debe figurar en inventario en "${fromLabel}" (origen del evento).`
                : `Regreso: el equipo debe figurar en inventario en "${toLabel}" (destino del evento).`}
            </p>
            {wrongOriginCount > 0 && phase === 'OUTBOUND' && (
              <p className="text-xs text-amber-400 mt-2 text-center flex items-center justify-center gap-1">
                <AlertTriangle className="h-3.5 w-3.5" />
                {wrongOriginCount} pendiente(s) con ubicación distinta al origen — revisa la lista abajo
              </p>
            )}
          </div>
          <div className="space-y-3">
            <h2 className="font-semibold">Último escaneo</h2>
            <AnimatePresence mode="wait">
              {lastScan ? (
                <motion.div
                  key={lastScan.message}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    'rounded-xl border p-4',
                    lastScan.success ? 'border-green-500/40 bg-green-500/10' : 'border-red-500/40 bg-red-500/10'
                  )}
                >
                  {lastScan.success ? (
                    <CheckCircle2 className="h-8 w-8 text-green-400 mb-2" />
                  ) : (
                    <XCircle className="h-8 w-8 text-red-400 mb-2" />
                  )}
                  <p className="font-medium">{lastScan.message}</p>
                  {lastScan.device && (
                    <p className="text-sm text-muted mt-1">
                      {lastScan.device.name} · <span className="font-mono">{lastScan.device.internalCode}</span>
                    </p>
                  )}
                </motion.div>
              ) : (
                <div className="rounded-xl border border-border p-6 text-center text-muted">
                  <Package className="h-10 w-10 mx-auto mb-2 opacity-50" />
                  Escanea un equipo para ver el resultado aquí
                </div>
              )}
            </AnimatePresence>
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200/90 flex gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              {phase === 'OUTBOUND'
                ? `Verifica que cada equipo esté en "${fromLabel}" antes de sacarlo.`
                : `Verifica que cada equipo esté en "${toLabel}" antes de guardarlo.`}
            </div>
          </div>
        </div>
      )}

      {/* Lista de equipos */}
      <div>
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
          <h2 className="font-semibold">Equipos ({event.items.length})</h2>
          <div className="flex gap-2">
            {(['all', 'pending', 'done'] as const).map((f) => (
              <Button key={f} variant={filter === f ? 'default' : 'outline'} size="sm" onClick={() => setFilter(f)}>
                {f === 'all' ? 'Todos' : f === 'pending' ? 'Pendientes' : 'Verificados'}
              </Button>
            ))}
            {canManage && isDraft && (
              <Button variant="ghost" size="sm" onClick={() => setPickerOpen(true)} className="text-muted">
                <Plus className="h-4 w-4 mr-1" /> Manual
              </Button>
            )}
          </div>
        </div>
        <ul className="space-y-2">
          {filteredItems.map((item) => {
            const done = phase === 'OUTBOUND' ? item.outboundScannedAt : item.inboundScannedAt;
            const doneUser = phase === 'OUTBOUND' ? item.outboundUserName : item.inboundUserName;
            const expectedLoc = phase === 'OUTBOUND' ? event.fromLocation : event.toLocation;
            const locMismatch = isActive && !done && item.device.location !== expectedLoc;
            return (
              <li
                key={item.id}
                className={cn(
                  'flex items-center gap-3 p-3 rounded-xl border',
                  done
                    ? 'border-green-500/30 bg-green-500/5'
                    : locMismatch
                      ? 'border-amber-500/40 bg-amber-500/5'
                      : 'border-border bg-card'
                )}
              >
                <div className="shrink-0">
                  {done ? (
                    <CheckCircle2 className="h-6 w-6 text-green-400" />
                  ) : locMismatch ? (
                    <AlertTriangle className="h-6 w-6 text-amber-400" />
                  ) : (
                    <Circle className="h-6 w-6 text-muted" />
                  )}
                </div>
                <div className="h-10 w-10 rounded-lg bg-card-hover overflow-hidden shrink-0 flex items-center justify-center">
                  {item.device.images?.[0]?.url ? (
                    <img src={item.device.images[0].url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <Package className="h-5 w-5 text-muted" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{item.device.name}</p>
                  <p className="text-xs text-muted font-mono">
                    {item.device.internalCode}
                    {item.device.serialNumber ? ` · ${item.device.serialNumber}` : ''}
                  </p>
                  <p className={cn('text-xs mt-0.5', locMismatch ? 'text-amber-400' : 'text-muted')}>
                    Ubicación en inventario: {locationLabel(item.device.location)}
                    {locMismatch &&
                      ` · se espera ${phase === 'OUTBOUND' ? fromLabel : toLabel}`}
                  </p>
                  {done && doneUser && (
                    <p className="text-xs text-green-400/80 mt-0.5">Verificado por {doneUser}</p>
                  )}
                  {phase === 'INBOUND' && item.outboundScannedAt && !item.inboundScannedAt && (
                    <p className="text-xs text-muted mt-0.5">Salida OK · pendiente regreso</p>
                  )}
                </div>
                {canManage && isDraft && (
                  <Button variant="ghost" size="sm" className="text-destructive shrink-0" onClick={() => handleRemoveItem(item.id, item.device.name)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </li>
            );
          })}
          {filteredItems.length === 0 && (
            <li className="text-center py-8 text-muted">No hay equipos en este filtro</li>
          )}
        </ul>
      </div>

      <DevicePickerModal
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        cartIds={event.items.map((i) => i.device.id)}
        onAdd={async (devices) => {
          try {
            await api.post(`/api/events/${id}/items`, { deviceIds: devices.map((d) => d.id) });
            await queryClient.invalidateQueries({ queryKey: ['event', id] });
            toast.success(`${devices.length} equipo(s) agregado(s)`);
          } catch {
            toast.error('Error al agregar equipos');
          }
        }}
      />
    </motion.div>
  );
}
