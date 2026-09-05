import { useCallback, useEffect, useRef, useState } from 'react';
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
  ListPlus,
  Pencil,
  Send,
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
  listId: string | null;
  originLocation: string | null;
  outboundScannedAt: string | null;
  inboundScannedAt: string | null;
  outboundUserName: string | null;
  inboundUserName: string | null;
  outboundMovementId: string | null;
  inboundMovementId: string | null;
  device: {
    id: string;
    name: string;
    internalCode: string;
    serialNumber: string | null;
    location: string;
    images?: { url: string }[];
  };
}

interface EventList {
  id: string;
  name: string;
  kind: 'CUSTOM' | 'CATEGORY';
  categoryId: string | null;
  items: EventItem[];
  stats: {
    total: number;
    outboundDone: number;
    inboundDone: number;
    outboundPending: number;
    inboundPending: number;
    outboundSent?: number;
    inboundSent?: number;
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
  lists: EventList[];
  items: EventItem[];
  stats: {
    total: number;
    outboundDone: number;
    inboundDone: number;
    outboundPending: number;
    inboundPending: number;
    outboundSent?: number;
    inboundSent?: number;
  };
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

interface CategoryNode {
  id: string;
  name: string;
  children?: CategoryNode[];
}

function flattenCategories(nodes: CategoryNode[], prefix = ''): { id: string; name: string }[] {
  const out: { id: string; name: string }[] = [];
  for (const n of nodes) {
    const name = prefix ? `${prefix} / ${n.name}` : n.name;
    out.push({ id: n.id, name });
    if (n.children?.length) out.push(...flattenCategories(n.children, name));
  }
  return out;
}

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const { label: locationLabel } = useLocations();
  const canManage = hasPermission('events.manage');
  const canScan = hasPermission('events.scan');

  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerCategoryId, setPickerCategoryId] = useState<string | null>(null);
  const [pickerTitle, setPickerTitle] = useState('Agregar equipos a la lista');
  const [scanning, setScanning] = useState(canScan);
  const [addingScan, setAddingScan] = useState(true);
  const [lastScan, setLastScan] = useState<ScanResult | null>(null);
  const [lastAdded, setLastAdded] = useState<AddScanResult | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [activating, setActivating] = useState(false);
  const [filter, setFilter] = useState<'all' | 'pending' | 'done'>('all');
  const [activeListId, setActiveListId] = useState<string | null>(null);
  const [createListOpen, setCreateListOpen] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [newListKind, setNewListKind] = useState<'CUSTOM' | 'CATEGORY'>('CUSTOM');
  const [newListCategoryId, setNewListCategoryId] = useState('');
  const [creatingList, setCreatingList] = useState(false);
  const [renamingListId, setRenamingListId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const scanBusyRef = useRef(false);
  const eventItemsRef = useRef<EventItem[]>([]);

  const { data: event, isLoading } = useQuery({
    queryKey: ['event', id],
    queryFn: async () => {
      const { data } = await api.get<EventDetail>(`/api/events/${id}`);
      return data;
    },
    enabled: !!id,
    refetchInterval: (q) => (q.state.data?.status === 'ACTIVE' ? 5000 : false),
  });

  const { data: stranded } = useQuery({
    queryKey: ['event-stranded', id],
    queryFn: async () => {
      const { data } = await api.get<{
        eventLocationLabel: string;
        fromLocationLabel: string;
        devices: {
          id: string;
          name: string;
          internalCode: string;
          onEventList: boolean;
          suggestedReturnLabel: string;
        }[];
      }>(`/api/events/${id}/stranded`);
      return data;
    },
    enabled: !!id && !!event,
    refetchInterval: 15000,
  });

  const { data: categoriesData } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data } = await api.get('/api/categories');
      return data as CategoryNode[];
    },
    enabled: createListOpen,
  });
  const categories = Array.isArray(categoriesData) ? flattenCategories(categoriesData) : [];

  useEffect(() => {
    if (!event?.lists?.length) return;
    if (!activeListId || !event.lists.some((l) => l.id === activeListId)) {
      setActiveListId(event.lists[0].id);
    }
  }, [event?.lists, activeListId]);

  eventItemsRef.current = event?.items ?? [];

  const phase = event?.currentPhase ?? 'OUTBOUND';
  const isActive = event?.status === 'ACTIVE';
  const isDraft = event?.status === 'DRAFT';
  const activeList = event?.lists?.find((l) => l.id === activeListId) ?? event?.lists?.[0];

  const announceScan = (result: ScanResult) => {
    setLastScan(result);
    const toastId = `event-scan-${result.device?.id || result.code}-${result.code}`;

    if (result.code === 'ALREADY_SCANNED') {
      toast(result.message || 'Este equipo ya fue verificado', {
        id: toastId,
        icon: 'ℹ️',
        duration: 2800,
      });
      return;
    }
    if (result.success && result.code === 'OK') {
      toast.success(
        result.device ? `Equipo verificado: ${result.device.internalCode}` : 'Equipo verificado',
        { id: toastId, duration: 2800 }
      );
      return;
    }
    if (result.success) {
      toast.success(result.message, { id: toastId, duration: 2800 });
      return;
    }
    toast.error(result.message, { id: toastId, duration: 3500 });
  };

  const matchItemByCode = (raw: string) => {
    const code = raw.trim().toLowerCase();
    if (!code) return null;
    return (
      eventItemsRef.current.find((i) => {
        const ic = i.device.internalCode?.toLowerCase();
        const sn = i.device.serialNumber?.toLowerCase();
        return i.device.id === raw.trim() || ic === code || (sn && sn === code);
      }) ?? null
    );
  };

  const handleDraftAddScan = useCallback(
    async (code: string) => {
      if (!id || !isDraft) return;
      try {
        const { data } = await api.post<AddScanResult>(`/api/events/${id}/add-by-scan`, {
          code,
          listId: activeListId || undefined,
        });
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
    [id, isDraft, activeListId, queryClient]
  );

  const handleScan = useCallback(
    async (code: string) => {
      if (!id || !canScan || !isActive || scanBusyRef.current) return;

      // Si ya está verificado en esta sesión/lista, avisar sin saturar la API
      const local = matchItemByCode(code);
      if (local) {
        const already =
          phase === 'OUTBOUND' ? !!local.outboundScannedAt : !!local.inboundScannedAt;
        if (already) {
          announceScan({
            success: true,
            code: 'ALREADY_SCANNED',
            message: 'Este equipo ya fue verificado',
            device: {
              id: local.device.id,
              name: local.device.name,
              internalCode: local.device.internalCode,
            },
          });
          return;
        }
      }

      scanBusyRef.current = true;
      try {
        const { data } = await api.post<ScanResult>(`/api/events/${id}/scan`, { code, phase });
        announceScan(data);
        if (data.success && data.code === 'OK') {
          await queryClient.invalidateQueries({ queryKey: ['event', id] });
          await queryClient.invalidateQueries({ queryKey: ['events'] });
        }
      } catch (err: unknown) {
        const res = (err as { response?: { data?: ScanResult } })?.response?.data;
        if (res) {
          announceScan(res);
        } else {
          toast.error('Error al escanear');
        }
      } finally {
        // Pequeña pausa para que no dispare otra lectura inmediata
        setTimeout(() => {
          scanBusyRef.current = false;
        }, 600);
      }
    },
    [id, canScan, isActive, phase, queryClient]
  );

  const handleActivate = async () => {
    if (!id || !event) return;
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

  const handleSendToMovements = async (listOnly = false) => {
    if (!id || !event) return;
    const isOutbound = phase === 'OUTBOUND';
    const scope = listOnly && activeList ? `la lista "${activeList.name}"` : 'todas las listas';
    const msg = isOutbound
      ? `¿Enviar ${scope} a Movimientos? El responsable deberá autorizar el traslado antes de que cambie la ubicación.`
      : `¿Enviar el regreso de ${scope} a Movimientos para autorización?`;
    if (!confirm(msg)) return;
    setConfirming(true);
    try {
      const { data } = await api.post<{ message?: string; created?: number }>(`/api/events/${id}/send-to-movements`, {
        phase,
        listId: listOnly ? activeListId : undefined,
      });
      await queryClient.invalidateQueries({ queryKey: ['event', id] });
      await queryClient.invalidateQueries({ queryKey: ['events'] });
      await queryClient.invalidateQueries({ queryKey: ['movements-pending'] });
      toast.success(data.message || 'Enviado a Movimientos');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Error';
      toast.error(msg);
    } finally {
      setConfirming(false);
    }
  };

  const openManualPicker = (opts?: { categoryId?: string | null; title?: string }) => {
    setPickerCategoryId(opts?.categoryId ?? null);
    setPickerTitle(opts?.title ?? 'Agregar equipos a la lista');
    setPickerOpen(true);
  };

  const handleCreateList = async () => {
    if (!id) return;
    if (newListKind === 'CUSTOM' && !newListName.trim()) {
      toast.error('Indica el nombre de la lista');
      return;
    }
    if (newListKind === 'CATEGORY' && !newListCategoryId) {
      toast.error('Elige una categoría');
      return;
    }
    setCreatingList(true);
    try {
      const { data } = await api.post<EventDetail>(`/api/events/${id}/lists`, {
        name: newListName.trim() || undefined,
        kind: newListKind,
        categoryId: newListKind === 'CATEGORY' ? newListCategoryId : undefined,
      });
      await queryClient.invalidateQueries({ queryKey: ['event', id] });
      const created = data.lists?.[data.lists.length - 1];
      if (created) setActiveListId(created.id);
      setCreateListOpen(false);
      setNewListName('');
      const catId = newListKind === 'CATEGORY' ? newListCategoryId : null;
      setNewListCategoryId('');
      setNewListKind('CUSTOM');
      toast.success(catId ? 'Lista creada — elige los equipos de la categoría' : 'Lista creada');
      if (catId && created) {
        openManualPicker({
          categoryId: catId,
          title: `Elegir equipos · ${created.name}`,
        });
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Error';
      toast.error(msg);
    } finally {
      setCreatingList(false);
    }
  };

  const handleRenameList = async (listId: string) => {
    if (!id || !renameValue.trim()) return;
    try {
      await api.patch(`/api/events/${id}/lists/${listId}`, { name: renameValue.trim() });
      await queryClient.invalidateQueries({ queryKey: ['event', id] });
      setRenamingListId(null);
      toast.success('Lista actualizada');
    } catch {
      toast.error('No se pudo renombrar');
    }
  };

  const handleDeleteList = async (list: EventList) => {
    if (!id || !confirm(`¿Eliminar la lista "${list.name}" y sus equipos del evento?`)) return;
    try {
      await api.delete(`/api/events/${id}/lists/${list.id}`);
      await queryClient.invalidateQueries({ queryKey: ['event', id] });
      toast.success('Lista eliminada');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Error';
      toast.error(msg);
    }
  };

  const handleRemoveItem = async (itemId: string, name: string, deviceLocation?: string) => {
    if (!id || !event) return;
    const atEvent = deviceLocation === event.toLocation;
    let restore = false;
    if (atEvent) {
      const withRestore = confirm(
        `"${name}" está en el lugar del evento.\n\nAceptar: quitar de la lista y devolverlo al origen/almacén.\nCancelar: ver otra opción.`
      );
      if (withRestore) {
        restore = true;
      } else {
        const onlyList = confirm(`¿Quitar solo de la lista? (el equipo seguirá en el lugar del evento)`);
        if (!onlyList) return;
      }
    } else if (!confirm(`¿Quitar "${name}" de la lista?`)) {
      return;
    }
    try {
      await api.delete(`/api/events/${id}/items/${itemId}${restore ? '?restoreLocation=1' : ''}`);
      await queryClient.invalidateQueries({ queryKey: ['event', id] });
      await queryClient.invalidateQueries({ queryKey: ['event-stranded', id] });
      if (restore) await queryClient.invalidateQueries({ queryKey: ['devices'] });
      toast.success(restore ? 'Equipo quitado y ubicación corregida' : 'Equipo quitado');
    } catch {
      toast.error('No se pudo quitar');
    }
  };

  const handleRestoreStranded = async (deviceIds?: string[]) => {
    if (!id || !event) return;
    const msg = deviceIds?.length
      ? `¿Devolver ${deviceIds.length} equipo(s) desde "${toLabel}" al origen del evento?`
      : `¿Devolver TODOS los equipos que siguen en "${toLabel}" al origen del evento?`;
    if (!confirm(msg)) return;
    try {
      const { data } = await api.post<{ restored: number }>(`/api/events/${id}/restore-locations`, {
        deviceIds,
        toLocation: event.fromLocation,
      });
      await queryClient.invalidateQueries({ queryKey: ['event-stranded', id] });
      await queryClient.invalidateQueries({ queryKey: ['devices'] });
      toast.success(`${data.restored} equipo(s) devuelto(s) a ${fromLabel}`);
    } catch (err: unknown) {
      const m = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Error';
      toast.error(m);
    }
  };

  if (isLoading || !event) {
    return <div className="py-20 text-center text-muted">Cargando evento...</div>;
  }

  const listItems = activeList?.items ?? [];
  const progress = phase === 'OUTBOUND' ? event.stats.outboundDone : event.stats.inboundDone;
  const progressPct = event.stats.total ? Math.round((progress / event.stats.total) * 100) : 0;
  const listProgress = phase === 'OUTBOUND' ? activeList?.stats.outboundDone ?? 0 : activeList?.stats.inboundDone ?? 0;
  const listTotal = activeList?.stats.total ?? 0;
  const listReady =
    listTotal > 0 &&
    (phase === 'OUTBOUND'
      ? listProgress === listTotal && (activeList?.stats.outboundSent ?? 0) < listTotal
      : listProgress === listTotal && (activeList?.stats.inboundSent ?? 0) < listTotal);
  const allReady =
    event.stats.total > 0 &&
    progressPct === 100 &&
    (phase === 'OUTBOUND'
      ? (event.stats.outboundSent ?? 0) < event.stats.total
      : (event.stats.inboundSent ?? 0) < event.stats.total);

  const filteredItems = listItems.filter((item) => {
    const done = phase === 'OUTBOUND' ? item.outboundScannedAt : item.inboundScannedAt;
    if (filter === 'pending') return !done;
    if (filter === 'done') return !!done;
    return true;
  });

  const fromLabel = event.fromLocationLabel ?? locationLabel(event.fromLocation);
  const toLabel = event.toLocationLabel ?? locationLabel(event.toLocation);

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
            Destino del evento: {toLabel}
            {event.toLocationIsTemporary && <span className="text-primary/80"> (lugar temporal)</span>}
            <span className="text-muted/70"> · origen ref. {fromLabel}</span>
          </p>
        </div>
      </div>

      {/* Equipos atrapados en el lugar temporal del evento */}
      {canManage && (stranded?.devices?.length ?? 0) > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/40 rounded-xl p-4 space-y-3">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div>
              <h2 className="font-semibold flex items-center gap-2 text-amber-200">
                <AlertTriangle className="h-4 w-4" />
                Equipos aún en “{stranded?.eventLocationLabel}”
              </h2>
              <p className="text-xs text-muted mt-1">
                Están marcados en el lugar del evento (puede ser temporal). Si ya no van a usarse aquí, devuélvelos
                a un lugar registrado del inventario.
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={() => handleRestoreStranded()}>
              Devolver todos a {fromLabel}
            </Button>
          </div>
          <ul className="space-y-2">
            {stranded!.devices.map((d) => (
              <li
                key={d.id}
                className="flex items-center justify-between gap-2 p-2 rounded-lg bg-card/60 border border-border text-sm"
              >
                <div className="min-w-0">
                  <p className="font-medium truncate">{d.name}</p>
                  <p className="text-xs font-mono text-muted">
                    {d.internalCode}
                    {!d.onEventList && ' · ya no está en la lista'}
                  </p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => handleRestoreStranded([d.id])}>
                  Devolver
                </Button>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted">
            También puedes corregir la ubicación editando el equipo en Inventario.
          </p>
        </div>
      )}

      {/* Listas */}
      <div className="bg-card rounded-xl border border-border p-4 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h2 className="font-semibold flex items-center gap-2">
            <ListPlus className="h-4 w-4 text-primary" /> Listas del evento
          </h2>
          {canManage && event.status !== 'COMPLETED' && event.status !== 'CANCELLED' && (
            <Button size="sm" variant="outline" onClick={() => setCreateListOpen((v) => !v)}>
              <Plus className="h-4 w-4 mr-1" /> Nueva lista
            </Button>
          )}
        </div>
        <p className="text-xs text-muted">
          Organiza equipos por categoría o listas personalizadas (micrófonos, parlantes, etc.). Pueden venir de distintos
          lugares; al verificar se registra su origen real.
        </p>

        {createListOpen && canManage && (
          <div className="rounded-lg border border-border bg-background p-3 space-y-3">
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={newListKind === 'CUSTOM' ? 'default' : 'outline'}
                onClick={() => setNewListKind('CUSTOM')}
              >
                Personalizada
              </Button>
              <Button
                size="sm"
                variant={newListKind === 'CATEGORY' ? 'default' : 'outline'}
                onClick={() => setNewListKind('CATEGORY')}
              >
                Por categoría
              </Button>
            </div>
            {newListKind === 'CUSTOM' ? (
              <input
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                placeholder="Ej. Micrófonos, Parlantes…"
                className="w-full h-10 px-3 rounded-md bg-card border border-border text-sm"
              />
            ) : (
              <select
                value={newListCategoryId}
                onChange={(e) => setNewListCategoryId(e.target.value)}
                className="w-full h-10 px-3 rounded-md bg-card border border-border text-sm"
              >
                <option value="">Seleccionar categoría…</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}
            {newListKind === 'CATEGORY' && (
              <input
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                placeholder="Nombre opcional (si vacío usa el de la categoría)"
                className="w-full h-10 px-3 rounded-md bg-card border border-border text-sm"
              />
            )}
            {newListKind === 'CATEGORY' && (
              <p className="text-xs text-muted">
                La lista se crea vacía; después eliges qué equipos de esa categoría incluir.
              </p>
            )}
            <div className="flex gap-2">
              <Button size="sm" onClick={handleCreateList} disabled={creatingList}>
                {creatingList ? 'Creando…' : 'Crear lista'}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setCreateListOpen(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        )}

        <div className="flex gap-2 flex-wrap">
          {event.lists.map((list) => (
            <button
              key={list.id}
              type="button"
              onClick={() => setActiveListId(list.id)}
              className={cn(
                'px-3 py-2 rounded-lg border text-sm text-left min-w-[140px]',
                activeListId === list.id ? 'border-primary bg-primary/10' : 'border-border hover:bg-card-hover'
              )}
            >
              <span className="font-medium block truncate">{list.name}</span>
              <span className="text-xs text-muted">
                {list.stats.total} equipo{list.stats.total !== 1 ? 's' : ''}
                {list.kind === 'CATEGORY' ? ' · categoría' : ''}
              </span>
            </button>
          ))}
        </div>

        {activeList && canManage && event.status !== 'COMPLETED' && (
          <div className="flex flex-wrap gap-2 items-center">
            {renamingListId === activeList.id ? (
              <>
                <input
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  className="h-9 px-2 rounded-md bg-background border border-border text-sm flex-1 min-w-[160px]"
                />
                <Button size="sm" onClick={() => handleRenameList(activeList.id)}>
                  Guardar
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setRenamingListId(null)}>
                  Cancelar
                </Button>
              </>
            ) : (
              <>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setRenamingListId(activeList.id);
                    setRenameValue(activeList.name);
                  }}
                >
                  <Pencil className="h-3.5 w-3.5 mr-1" /> Renombrar
                </Button>
                {event.lists.length > 1 && (
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleDeleteList(activeList)}>
                    <Trash2 className="h-3.5 w-3.5 mr-1" /> Eliminar lista
                  </Button>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Borrador: escanear para armar la lista activa */}
      {isDraft && (canManage || canScan) && (
        <div className="bg-primary/5 border border-primary/30 rounded-xl p-4 space-y-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <h2 className="font-semibold text-lg">Escanea para agregar a “{activeList?.name ?? 'lista'}”</h2>
              <p className="text-sm text-muted mt-0.5">
                Los equipos pueden estar en distintos lugares. Total del evento: {event.items.length}.
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
              </span>
            </div>
          )}
          {canManage && (
            <Button variant="outline" size="sm" onClick={() => openManualPicker()} className="w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-1" /> Buscar manualmente
            </Button>
          )}
        </div>
      )}

      {/* Progreso global */}
      <div className="bg-card rounded-xl border border-border p-4 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <span className="font-medium">
            {phase === 'OUTBOUND' ? (
              <span className="flex items-center gap-2">
                <Truck className="h-4 w-4 text-primary" /> Checklist de salida
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Home className="h-4 w-4 text-primary" /> Checklist de regreso
              </span>
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
          <Button className="w-full min-h-touch" onClick={handleActivate} disabled={activating || event.items.length === 0}>
            <Play className="h-4 w-4 mr-2" />
            {activating
              ? 'Activando...'
              : event.items.length === 0
                ? 'Agrega equipos a una lista antes de activar'
                : `Activar evento (${event.items.length} equipos · ${event.lists.length} listas)`}
          </Button>
        )}
        {isActive && canManage && (
          <div className="flex flex-col sm:flex-row gap-2">
            {listReady && (
              <Button className="flex-1 min-h-touch" variant="outline" onClick={() => handleSendToMovements(true)} disabled={confirming}>
                <Send className="h-4 w-4 mr-2" />
                Enviar lista a Movimientos
              </Button>
            )}
            {allReady && (
              <Button className="flex-1 min-h-touch" onClick={() => handleSendToMovements(false)} disabled={confirming}>
                <Send className="h-4 w-4 mr-2" />
                {confirming
                  ? 'Enviando...'
                  : phase === 'OUTBOUND'
                    ? 'Enviar todo a Movimientos (autorizar salida)'
                    : 'Enviar regreso a Movimientos'}
              </Button>
            )}
          </div>
        )}
        {isActive && (event.stats.outboundSent || event.stats.inboundSent) ? (
          <p className="text-xs text-amber-400 flex items-center gap-1">
            <AlertTriangle className="h-3.5 w-3.5" />
            Hay traslados pendientes de autorización en{' '}
            <Link to="/movements" className="underline text-primary">
              Movimientos
            </Link>
            .
          </p>
        ) : null}
        {event.status === 'COMPLETED' && (
          <p className="text-sm text-green-400 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" /> Evento completado
          </p>
        )}
      </div>

      {isActive && canScan && (
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-semibold">Escanear código de barras</h2>
              <Button variant="ghost" size="sm" onClick={() => setScanning((s) => !s)}>
                {scanning ? 'Pausar' : 'Reanudar'}
              </Button>
            </div>
            <BarcodeScanner
              readerId={`event-scanner-${id}`}
              active={scanning}
              onScan={handleScan}
              sameCodeCooldownMs={4000}
            />
            <p className="text-xs text-muted mt-2 text-center">
              {phase === 'OUTBOUND'
                ? 'Salida: verifica cada equipo de cualquier lista. Se guarda su ubicación actual como origen.'
                : `Regreso: el equipo debe figurar en inventario en "${toLabel}".`}
            </p>
          </div>
          <div className="space-y-3">
            <h2 className="font-semibold">Último escaneo</h2>
            <AnimatePresence mode="wait">
              {lastScan ? (
                <motion.div
                  key={`${lastScan.code}-${lastScan.device?.id ?? ''}-${lastScan.message}`}
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className={cn(
                    'rounded-xl border p-4',
                    lastScan.code === 'ALREADY_SCANNED'
                      ? 'border-amber-500/40 bg-amber-500/10'
                      : lastScan.success
                        ? 'border-green-500/40 bg-green-500/10'
                        : 'border-red-500/40 bg-red-500/10'
                  )}
                >
                  {lastScan.code === 'ALREADY_SCANNED' ? (
                    <AlertTriangle className="h-8 w-8 text-amber-400 mb-2" />
                  ) : lastScan.success ? (
                    <CheckCircle2 className="h-8 w-8 text-green-400 mb-2" />
                  ) : (
                    <XCircle className="h-8 w-8 text-red-400 mb-2" />
                  )}
                  <p
                    className={cn(
                      'font-display text-lg font-semibold',
                      lastScan.code === 'ALREADY_SCANNED'
                        ? 'text-amber-300'
                        : lastScan.success
                          ? 'text-green-300'
                          : 'text-red-300'
                    )}
                  >
                    {lastScan.code === 'ALREADY_SCANNED'
                      ? 'Ya fue verificado'
                      : lastScan.success && lastScan.code === 'OK'
                        ? 'Equipo verificado'
                        : lastScan.success
                          ? 'Listo'
                          : 'No verificado'}
                  </p>
                  <p className="text-sm mt-1 text-foreground/90">{lastScan.message}</p>
                  {lastScan.device && (
                    <p className="text-sm text-muted mt-2">
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
          </div>
        </div>
      )}

      {/* Equipos de la lista activa */}
      <div>
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
          <h2 className="font-semibold">
            {activeList?.name ?? 'Equipos'} ({listItems.length})
          </h2>
          <div className="flex gap-2 flex-wrap">
            {(['all', 'pending', 'done'] as const).map((f) => (
              <Button key={f} variant={filter === f ? 'default' : 'outline'} size="sm" onClick={() => setFilter(f)}>
                {f === 'all' ? 'Todos' : f === 'pending' ? 'Pendientes' : 'Verificados'}
              </Button>
            ))}
            {canManage && isDraft && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  openManualPicker({
                    categoryId: activeList?.kind === 'CATEGORY' ? activeList.categoryId : null,
                    title: activeList ? `Agregar a “${activeList.name}”` : 'Agregar equipos',
                  })
                }
                className="text-muted"
              >
                <Plus className="h-4 w-4 mr-1" /> Manual
              </Button>
            )}
          </div>
        </div>
        <ul className="space-y-2">
          {filteredItems.map((item) => {
            const done = phase === 'OUTBOUND' ? item.outboundScannedAt : item.inboundScannedAt;
            const doneUser = phase === 'OUTBOUND' ? item.outboundUserName : item.inboundUserName;
            const sent = phase === 'OUTBOUND' ? item.outboundMovementId : item.inboundMovementId;
            return (
              <li
                key={item.id}
                className={cn(
                  'flex items-center gap-3 p-3 rounded-xl border',
                  done ? 'border-green-500/30 bg-green-500/5' : 'border-border bg-card'
                )}
              >
                <div className="shrink-0">
                  {done ? <CheckCircle2 className="h-6 w-6 text-green-400" /> : <Circle className="h-6 w-6 text-muted" />}
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
                  <p className="text-xs text-muted mt-0.5">
                    Ubicación: {locationLabel(item.device.location)}
                    {item.originLocation ? ` · origen verificado: ${locationLabel(item.originLocation)}` : ''}
                  </p>
                  {done && doneUser && <p className="text-xs text-green-400/80 mt-0.5">Verificado por {doneUser}</p>}
                  {sent && <p className="text-xs text-amber-400 mt-0.5">Enviado a Movimientos (pendiente autorización)</p>}
                </div>
                {canManage && (isDraft || item.device.location === event.toLocation) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive shrink-0"
                    onClick={() => handleRemoveItem(item.id, item.device.name, item.device.location)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </li>
            );
          })}
          {filteredItems.length === 0 && <li className="text-center py-8 text-muted">No hay equipos en este filtro</li>}
        </ul>
      </div>

      <DevicePickerModal
        open={pickerOpen}
        onOpenChange={(open) => {
          setPickerOpen(open);
          if (!open) setPickerCategoryId(null);
        }}
        cartIds={event.items.map((i) => i.device.id)}
        categoryId={pickerCategoryId}
        title={pickerTitle}
        alreadyInLabel="En el evento"
        onAdd={async (devices) => {
          try {
            await api.post(`/api/events/${id}/items`, {
              deviceIds: devices.map((d) => d.id),
              listId: activeListId || undefined,
            });
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
