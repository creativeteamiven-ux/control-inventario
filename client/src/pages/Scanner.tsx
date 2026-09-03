import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import {
  ScanLine,
  Camera,
  CameraOff,
  Package,
  Pencil,
  ArrowRight,
  AlertTriangle,
  RotateCcw,
  Loader2,
  CheckCircle2,
  SwitchCamera,
  Truck,
  Check,
  CalendarDays,
  ListPlus,
  ExternalLink,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { addToStoredCart, getStoredCart } from '@/lib/transferCart';
import { getBuildEventId, setBuildEventId } from '@/lib/eventBuild';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { deviceStatusLabel } from '@/lib/statusLabels';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { useLocations } from '@/hooks/useLocations';
import BarcodeScanner from '@/components/BarcodeScanner';

const READER_ID = 'barcode-reader';

/** Formatos 1D priorizados: CODE128 es el de nuestras etiquetas; el resto cubre series de fábrica. */
const BARCODE_FORMATS = [
  Html5QrcodeSupportedFormats.CODE_128,
  Html5QrcodeSupportedFormats.CODE_39,
  Html5QrcodeSupportedFormats.EAN_13,
  Html5QrcodeSupportedFormats.EAN_8,
  Html5QrcodeSupportedFormats.UPC_A,
  Html5QrcodeSupportedFormats.UPC_E,
  Html5QrcodeSupportedFormats.ITF,
  Html5QrcodeSupportedFormats.CODABAR,
];

const STATUS_BADGE: Record<string, string> = {
  ACTIVE: 'bg-green-500/20 text-green-400',
  MAINTENANCE: 'bg-amber-500/20 text-amber-400',
  LOANED: 'bg-blue-500/20 text-blue-400',
  DAMAGED: 'bg-red-500/20 text-red-400',
  LOST: 'bg-gray-500/20 text-gray-400',
  RETIRED: 'bg-slate-500/20 text-slate-400',
};

const QUICK_STATUSES: { value: string; label: string; className: string }[] = [
  { value: 'ACTIVE', label: 'Operativo', className: 'border-green-500/40 text-green-400 hover:bg-green-500/10' },
  { value: 'MAINTENANCE', label: 'Mantenimiento', className: 'border-amber-500/40 text-amber-400 hover:bg-amber-500/10' },
  { value: 'DAMAGED', label: 'Dañado', className: 'border-red-500/40 text-red-400 hover:bg-red-500/10' },
];

interface CameraOption {
  id: string;
  label: string;
}

function pickDefaultCamera(cams: CameraOption[]): string | undefined {
  if (!cams.length) return undefined;
  const back = cams.find((c) => /back|rear|environment|trasera|posterior/i.test(c.label));
  return (back ?? cams[cams.length - 1]).id;
}

/** Zona de escaneo ancha y baja, ideal para códigos de barras horizontales. */
function barcodeScanBox(viewW: number, viewH: number) {
  const width = Math.floor(viewW * 0.92);
  const height = Math.floor(Math.min(viewH * 0.32, 140));
  return { width, height };
}

interface ScannedDevice {
  id: string;
  internalCode: string;
  name: string;
  brand: string;
  model: string;
  serialNumber?: string | null;
  status: string;
  location: string;
  condition: number;
  observation?: string | null;
  category?: { name: string } | null;
  images?: { url: string }[];
}

interface DraftEvent {
  id: string;
  name: string;
  stats: { total: number };
}

interface AddScanResult {
  success: boolean;
  code: string;
  message: string;
  device?: { id: string; name: string; internalCode: string };
  total?: number;
}

type ScanMode = 'lookup' | 'event';

export default function Scanner() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { hasPermission } = usePermissions();
  const { label: locationLabel } = useLocations();
  const canEdit = (user?.role === 'ADMIN' || user?.role === 'MANAGER') && hasPermission('inventory.edit');
  const canEvent = hasPermission('events.manage') || hasPermission('events.scan');

  const initialMode: ScanMode = searchParams.get('mode') === 'event' && canEvent ? 'event' : 'lookup';
  const [mode, setMode] = useState<ScanMode>(initialMode);
  const [eventBuildId, setEventBuildIdState] = useState<string | null>(
    () => getBuildEventId() || searchParams.get('eventId')
  );
  const [eventScanActive, setEventScanActive] = useState(true);
  const [lastEventAdd, setLastEventAdd] = useState<AddScanResult | null>(null);
  const [addingToEvent, setAddingToEvent] = useState(false);
  const [selectedEventForDevice, setSelectedEventForDevice] = useState<string>('');

  const { data: draftEvents = [] } = useQuery({
    queryKey: ['events', 'DRAFT'],
    queryFn: async () => {
      const { data } = await api.get<DraftEvent[]>('/api/events', { params: { status: 'DRAFT' } });
      return data;
    },
    enabled: canEvent,
  });

  const activeEvent = draftEvents.find((e) => e.id === eventBuildId);

  useEffect(() => {
    setBuildEventId(eventBuildId);
  }, [eventBuildId]);

  useEffect(() => {
    if (eventBuildId && !draftEvents.some((e) => e.id === eventBuildId) && draftEvents.length) {
      setEventBuildIdState(draftEvents[0].id);
    }
  }, [draftEvents, eventBuildId]);

  useEffect(() => {
    if (!selectedEventForDevice && draftEvents.length) {
      setSelectedEventForDevice(eventBuildId || draftEvents[0].id);
    }
  }, [draftEvents, eventBuildId, selectedEventForDevice]);

  const handleEventAddScan = useCallback(
    async (code: string) => {
      if (!eventBuildId) {
        toast.error('Selecciona un evento en borrador');
        return;
      }
      try {
        const { data } = await api.post<AddScanResult>(`/api/events/${eventBuildId}/add-by-scan`, { code });
        setLastEventAdd(data);
        if (data.success) {
          toast.success(data.message, { duration: 1500 });
          await queryClient.invalidateQueries({ queryKey: ['events'] });
          await queryClient.invalidateQueries({ queryKey: ['event', eventBuildId] });
        } else {
          toast.error(data.message);
        }
      } catch (err: unknown) {
        const res = (err as { response?: { data?: AddScanResult } })?.response?.data;
        toast.error(res?.message || 'No se pudo agregar el equipo');
      }
    },
    [eventBuildId, queryClient]
  );

  const addDeviceToEvent = async (eventId: string) => {
    if (!device) return;
    setAddingToEvent(true);
    try {
      const code = device.serialNumber || device.internalCode;
      const { data } = await api.post<AddScanResult>(`/api/events/${eventId}/add-by-scan`, { code });
      if (data.success) {
        toast.success(data.message);
        await queryClient.invalidateQueries({ queryKey: ['events'] });
        await queryClient.invalidateQueries({ queryKey: ['event', eventId] });
      } else {
        toast.error(data.message);
      }
    } catch (err: unknown) {
      const res = (err as { response?: { data?: AddScanResult } })?.response?.data;
      toast.error(res?.message || 'No se pudo agregar al evento');
    } finally {
      setAddingToEvent(false);
    }
  };

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isStartingRef = useRef(false);
  const lastScanRef = useRef<{ code: string; at: number } | null>(null);

  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [looking, setLooking] = useState(false);
  const [device, setDevice] = useState<ScannedDevice | null>(null);
  const [notFoundCode, setNotFoundCode] = useState<string | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [cameras, setCameras] = useState<CameraOption[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string | null>(null);
  const [addedToCart, setAddedToCart] = useState(false);

  const secureContext =
    typeof window !== 'undefined' &&
    (window.isSecureContext || location.hostname === 'localhost' || location.hostname === '127.0.0.1');

  const stopCamera = useCallback(async () => {
    const inst = scannerRef.current;
    if (!inst) return;
    try {
      if (inst.isScanning) await inst.stop();
      inst.clear();
    } catch {
      /* ignore */
    }
    scannerRef.current = null;
    setScanning(false);
  }, []);

  const lookup = useCallback(async (code: string) => {
    setLooking(true);
    setDevice(null);
    setNotFoundCode(null);
    try {
      const { data } = await api.get<ScannedDevice>('/api/devices/lookup', { params: { code } });
      setDevice(data);
    } catch {
      setNotFoundCode(code);
    } finally {
      setLooking(false);
    }
  }, []);

  const handleScan = useCallback(
    async (decodedText: string) => {
      const code = decodedText.trim();
      if (!code) return;

      const now = Date.now();
      const prev = lastScanRef.current;
      if (prev && prev.code === code && now - prev.at < 2500) return;
      lastScanRef.current = { code, at: now };

      await stopCamera();
      await lookup(code);
    },
    [stopCamera, lookup]
  );

  const startCamera = useCallback(
    async (cameraId?: string) => {
      if (isStartingRef.current || scannerRef.current) return;
      if (!secureContext) {
        setCameraError(
          'La cámara requiere una conexión segura (HTTPS) o localhost. Abre la app por HTTPS para escanear desde el celular.'
        );
        return;
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError('Este navegador no permite acceder a la cámara.');
        return;
      }
      setCameraError(null);
      setDevice(null);
      setNotFoundCode(null);
      lastScanRef.current = null;
      isStartingRef.current = true;
      try {
        let cams = cameras;
        if (!cams.length) {
          try {
            const found = await Html5Qrcode.getCameras();
            cams = found.map((c) => ({ id: c.id, label: c.label || 'Cámara' }));
            setCameras(cams);
          } catch {
            cams = [];
          }
        }
        const camId = cameraId ?? selectedCameraId ?? pickDefaultCamera(cams);
        if (camId) setSelectedCameraId(camId);

        const html5 = new Html5Qrcode(READER_ID, {
          verbose: false,
          formatsToSupport: BARCODE_FORMATS,
          experimentalFeatures: { useBarCodeDetectorIfSupported: true },
        });
        scannerRef.current = html5;

        const cameraSource: string | MediaTrackConstraints = camId
          ? camId
          : {
              facingMode: { ideal: 'environment' },
              width: { min: 640, ideal: 1920 },
              height: { min: 480, ideal: 1080 },
            };

        await html5.start(
          cameraSource,
          {
            fps: 20,
            qrbox: barcodeScanBox,
            disableFlip: false,
            videoConstraints: camId
              ? {
                  deviceId: { exact: camId },
                  width: { min: 640, ideal: 1920 },
                  height: { min: 480, ideal: 1080 },
                }
              : {
                  facingMode: { ideal: 'environment' },
                  width: { min: 640, ideal: 1920 },
                  height: { min: 480, ideal: 1080 },
                },
          },
          (decodedText) => {
            void handleScan(decodedText);
          },
          () => {
            /* fallo de lectura por frame: ignorar */
          }
        );
        setScanning(true);
      } catch (err) {
        scannerRef.current = null;
        const msg = err instanceof Error ? err.message : String(err);
        setCameraError(
          /permission|denied|notallowed/i.test(msg)
            ? 'Permiso de cámara denegado. Habilítalo en los ajustes del navegador.'
            : /notfound|no.*camera|requested device/i.test(msg)
              ? 'No se encontró ninguna cámara conectada.'
              : 'No se pudo iniciar la cámara: ' + msg
        );
      } finally {
        isStartingRef.current = false;
      }
    },
    [secureContext, cameras, selectedCameraId, handleScan]
  );

  const switchCamera = useCallback(
    async (id: string) => {
      await stopCamera();
      setSelectedCameraId(id);
      await startCamera(id);
    },
    [stopCamera, startCamera]
  );

  useEffect(() => {
    if (mode === 'event') {
      void stopCamera();
    }
  }, [mode, stopCamera]);

  useEffect(() => {
    return () => {
      void stopCamera();
    };
  }, [stopCamera]);

  useEffect(() => {
    setAddedToCart(device ? getStoredCart().some((d) => d.id === device.id) : false);
  }, [device]);

  const addToCart = () => {
    if (!device) return;
    addToStoredCart({ id: device.id, internalCode: device.internalCode, name: device.name });
    setAddedToCart(true);
    toast.success('Agregado al carrito de traslado. Ve a Movimientos para continuar.');
  };

  const reset = useCallback(async () => {
    setDevice(null);
    setNotFoundCode(null);
    setCameraError(null);
    lastScanRef.current = null;
    await startCamera();
  }, [startCamera]);

  const changeStatus = async (status: string) => {
    if (!device) return;
    setUpdatingStatus(true);
    try {
      await api.patch(`/api/devices/${device.id}`, { status });
      setDevice({ ...device, status });
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      queryClient.invalidateQueries({ queryKey: ['device', device.id] });
      toast.success(`Estado actualizado a "${deviceStatusLabel(status)}"`);
    } catch {
      toast.error('No se pudo actualizar el estado');
    } finally {
      setUpdatingStatus(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
          <ScanLine className="h-6 w-6 text-primary" /> Escanear equipo
        </h1>
        <p className="text-sm text-muted mt-1">
          {mode === 'event'
            ? 'Escanea equipos uno tras otro para llenar la lista del evento. La cámara sigue activa entre lecturas.'
            : 'Apunta la cámara al código de barras de la etiqueta o al número de serie del equipo.'}
        </p>
      </div>

      {canEvent && (
        <div className="flex gap-2 p-1 bg-card rounded-lg border border-border">
          <Button
            variant={mode === 'lookup' ? 'default' : 'ghost'}
            size="sm"
            className="flex-1"
            onClick={() => setMode('lookup')}
          >
            <ScanLine className="h-4 w-4 mr-1.5" /> Consultar equipo
          </Button>
          <Button
            variant={mode === 'event' ? 'default' : 'ghost'}
            size="sm"
            className="flex-1"
            onClick={() => setMode('event')}
          >
            <ListPlus className="h-4 w-4 mr-1.5" /> Armar evento
          </Button>
        </div>
      )}

      {mode === 'event' && canEvent && (
        <div className="space-y-4">
          <div className="bg-card rounded-xl border border-border p-4 space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <label className="text-sm font-medium flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-primary" /> Evento activo
              </label>
              {activeEvent && (
                <Link to={`/events/${activeEvent.id}`} className="text-xs text-primary hover:underline flex items-center gap-1">
                  Ver lista <ExternalLink className="h-3 w-3" />
                </Link>
              )}
            </div>
            {draftEvents.length === 0 ? (
              <div className="text-sm text-muted space-y-2">
                <p>No hay eventos en borrador. Crea uno primero.</p>
                {hasPermission('events.manage') && (
                  <Button size="sm" onClick={() => navigate('/events')}>
                    Ir a Eventos
                  </Button>
                )}
              </div>
            ) : (
              <select
                value={eventBuildId ?? ''}
                onChange={(e) => setEventBuildIdState(e.target.value || null)}
                className="w-full h-10 px-3 rounded-md bg-background border border-border text-sm"
              >
                {draftEvents.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name} ({e.stats.total} equipos)
                  </option>
                ))}
              </select>
            )}
            {activeEvent && (
              <p className="text-xs text-muted">
                {activeEvent.stats.total} equipo{activeEvent.stats.total !== 1 ? 's' : ''} en la lista
              </p>
            )}
          </div>

          {eventBuildId && (
            <>
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm text-muted">Escaneo continuo</p>
                <Button variant="ghost" size="sm" onClick={() => setEventScanActive((s) => !s)}>
                  {eventScanActive ? 'Pausar' : 'Reanudar'}
                </Button>
              </div>
              <BarcodeScanner
                readerId="event-build-scanner"
                active={eventScanActive && !!eventBuildId}
                onScan={handleEventAddScan}
              />
              {lastEventAdd?.device && (
                <div className="flex items-center gap-2 text-sm text-green-400 bg-green-500/10 border border-green-500/30 rounded-lg px-3 py-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span>
                    {lastEventAdd.message} · <span className="font-mono">{lastEventAdd.device.internalCode}</span>
                    {lastEventAdd.total != null ? ` · Total: ${lastEventAdd.total}` : ''}
                  </span>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {mode === 'lookup' && (
      <>
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="relative bg-black aspect-[4/3] flex items-center justify-center">
          <div id={READER_ID} className="w-full h-full [&_video]:h-full [&_video]:w-full [&_video]:object-cover" />
          {scanning && (
            <div className="absolute bottom-3 left-0 right-0 text-center pointer-events-none">
              <span className="text-xs text-white/80 bg-black/50 px-3 py-1 rounded-full">
                Alinea el código de barras en el recuadro
              </span>
            </div>
          )}
          {!scanning && !looking && !device && !notFoundCode && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center">
              {cameraError ? (
                <>
                  <CameraOff className="h-12 w-12 text-red-400" />
                  <p className="text-sm text-red-300 max-w-sm">{cameraError}</p>
                  <Button onClick={() => startCamera()} variant="outline" className="min-h-touch">
                    <Camera className="h-4 w-4 mr-2" /> Reintentar
                  </Button>
                </>
              ) : (
                <>
                  <Camera className="h-14 w-14 text-muted" />
                  <Button onClick={() => startCamera()} className="min-h-touch">
                    <Camera className="h-5 w-5 mr-2" /> Iniciar cámara
                  </Button>
                </>
              )}
            </div>
          )}
          {looking && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/70">
              <Loader2 className="h-10 w-10 text-primary animate-spin" />
              <p className="text-sm text-foreground">Buscando equipo...</p>
            </div>
          )}
        </div>
        {scanning && (
          <div className="p-3 flex flex-wrap items-center justify-center gap-2 border-t border-border">
            {cameras.length > 1 && (
              <div className="relative flex items-center">
                <SwitchCamera className="absolute left-2.5 h-4 w-4 text-muted pointer-events-none" />
                <select
                  value={selectedCameraId ?? ''}
                  onChange={(e) => switchCamera(e.target.value)}
                  className="h-9 pl-8 pr-3 rounded-md bg-card border border-border text-sm max-w-[200px] truncate"
                  aria-label="Seleccionar cámara"
                >
                  {cameras.map((c, i) => (
                    <option key={c.id} value={c.id}>
                      {c.label || `Cámara ${i + 1}`}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <Button variant="ghost" size="sm" onClick={stopCamera} className="min-h-touch">
              <CameraOff className="h-4 w-4 mr-2" /> Detener
            </Button>
          </div>
        )}
      </div>

      {device && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card rounded-xl border border-border overflow-hidden"
        >
          <div className="flex items-start gap-4 p-4">
            <div className="h-20 w-20 rounded-lg bg-card-hover flex items-center justify-center overflow-hidden shrink-0">
              {device.images?.[0]?.url ? (
                <img src={device.images[0].url} alt={device.name} className="h-full w-full object-cover" />
              ) : (
                <Package className="h-9 w-9 text-muted" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={cn('px-2.5 py-1 rounded-full text-xs font-medium', STATUS_BADGE[device.status] ?? 'bg-muted')}>
                  {deviceStatusLabel(device.status)}
                </span>
                <span className="font-mono text-xs text-primary">{device.internalCode}</span>
              </div>
              <h2 className="font-display font-semibold text-lg mt-1 truncate">{device.name}</h2>
              <p className="text-sm text-muted truncate">
                {device.brand} {device.model}
                {device.category?.name ? ` · ${device.category.name}` : ''}
              </p>
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-px bg-border">
            <div className="bg-card p-3">
              <dt className="text-xs text-muted">Número de serie</dt>
              <dd className="text-sm font-medium truncate">{device.serialNumber || '—'}</dd>
            </div>
            <div className="bg-card p-3">
              <dt className="text-xs text-muted">Ubicación</dt>
              <dd className="text-sm font-medium truncate">{locationLabel(device.location)}</dd>
            </div>
            <div className="bg-card p-3 col-span-2">
              <dt className="text-xs text-muted">Condición</dt>
              <dd className="flex items-center gap-2 mt-1">
                <div className="flex-1 h-2 bg-card-hover rounded-full overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full',
                      device.condition >= 70 ? 'bg-green-500' : device.condition >= 40 ? 'bg-amber-500' : 'bg-red-500'
                    )}
                    style={{ width: `${device.condition}%` }}
                  />
                </div>
                <span className="text-sm font-medium">{device.condition}%</span>
              </dd>
            </div>
            {device.observation && (
              <div className="bg-card p-3 col-span-2">
                <dt className="text-xs text-muted">Observación / Novedad</dt>
                <dd className="text-sm mt-1 px-3 py-2 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                  {device.observation}
                </dd>
              </div>
            )}
          </dl>

          {canEdit && (
            <div className="p-4 border-t border-border">
              <p className="text-xs text-muted mb-2">Cambiar estado</p>
              <div className="flex flex-wrap gap-2">
                {QUICK_STATUSES.map((s) => (
                  <Button
                    key={s.value}
                    variant="outline"
                    size="sm"
                    disabled={updatingStatus || device.status === s.value}
                    onClick={() => changeStatus(s.value)}
                    className={cn('min-h-touch', s.className, device.status === s.value && 'opacity-50')}
                  >
                    {device.status === s.value && <CheckCircle2 className="h-4 w-4 mr-1.5" />}
                    {s.label}
                  </Button>
                ))}
              </div>
            </div>
          )}

          <div className="p-4 border-t border-border space-y-2">
            {canEvent && draftEvents.length > 0 && (
              <div className="flex gap-2">
                <select
                  value={selectedEventForDevice}
                  onChange={(e) => setSelectedEventForDevice(e.target.value)}
                  className="flex-1 h-10 px-3 rounded-md bg-background border border-border text-sm min-w-0"
                >
                  {draftEvents.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name}
                    </option>
                  ))}
                </select>
                <Button
                  variant="outline"
                  className="min-h-touch shrink-0"
                  disabled={addingToEvent || !selectedEventForDevice}
                  onClick={() => addDeviceToEvent(selectedEventForDevice)}
                >
                  {addingToEvent ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <ListPlus className="h-4 w-4 mr-1" /> Agregar a evento
                    </>
                  )}
                </Button>
              </div>
            )}
            <Button
              variant={addedToCart ? 'outline' : 'default'}
              className="w-full min-h-touch"
              disabled={addedToCart}
              onClick={addToCart}
            >
              {addedToCart ? (
                <>
                  <Check className="h-4 w-4 mr-2" /> Ya está en el carrito
                </>
              ) : (
                <>
                  <Truck className="h-4 w-4 mr-2" /> Agregar al carrito de traslado
                </>
              )}
            </Button>
          </div>

          <div className="p-4 border-t border-border flex flex-col sm:flex-row gap-2">
            <Button className="flex-1 min-h-touch" onClick={() => navigate(`/inventory/${device.id}`)}>
              <ArrowRight className="h-4 w-4 mr-2" /> Ver ficha completa
            </Button>
            {canEdit && (
              <Button
                variant="outline"
                className="flex-1 min-h-touch"
                onClick={() => navigate(`/inventory/${device.id}`)}
              >
                <Pencil className="h-4 w-4 mr-2" /> Editar
              </Button>
            )}
            <Button variant="ghost" className="min-h-touch" onClick={reset}>
              <RotateCcw className="h-4 w-4 mr-2" /> Escanear otro
            </Button>
          </div>
        </motion.div>
      )}

      {notFoundCode && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card rounded-xl border border-amber-500/40 p-5 text-center space-y-3"
        >
          <AlertTriangle className="h-10 w-10 text-amber-400 mx-auto" />
          <div>
            <p className="font-medium">No se encontró ningún equipo</p>
            <p className="text-sm text-muted mt-1">
              Código leído: <span className="font-mono text-foreground break-all">{notFoundCode}</span>
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 justify-center">
            <Button onClick={reset} className="min-h-touch">
              <RotateCcw className="h-4 w-4 mr-2" /> Escanear de nuevo
            </Button>
            <Button
              variant="outline"
              className="min-h-touch"
              onClick={() => navigate(`/inventory?search=${encodeURIComponent(notFoundCode)}`)}
            >
              Buscar en inventario
            </Button>
          </div>
        </motion.div>
      )}
      </>
      )}
    </motion.div>
  );
}
