import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
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
  ShoppingCart,
  Check,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { addToStoredCart, getStoredCart } from '@/lib/transferCart';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { deviceStatusLabel } from '@/lib/statusLabels';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { useLocations } from '@/hooks/useLocations';

const READER_ID = 'qr-reader';

const STATUS_BADGE: Record<string, string> = {
  ACTIVE: 'bg-green-500/20 text-green-400',
  MAINTENANCE: 'bg-amber-500/20 text-amber-400',
  LOANED: 'bg-blue-500/20 text-blue-400',
  DAMAGED: 'bg-red-500/20 text-red-400',
  LOST: 'bg-gray-500/20 text-gray-400',
  RETIRED: 'bg-slate-500/20 text-slate-400',
};

// Estados que se pueden asignar con un toque desde el escáner.
const QUICK_STATUSES: { value: string; label: string; className: string }[] = [
  { value: 'ACTIVE', label: 'Operativo', className: 'border-green-500/40 text-green-400 hover:bg-green-500/10' },
  { value: 'MAINTENANCE', label: 'Mantenimiento', className: 'border-amber-500/40 text-amber-400 hover:bg-amber-500/10' },
  { value: 'DAMAGED', label: 'Dañado', className: 'border-red-500/40 text-red-400 hover:bg-red-500/10' },
];

interface CameraOption {
  id: string;
  label: string;
}

// Elige la cámara por defecto: trasera en móvil, o la única disponible en un computador/portátil.
function pickDefaultCamera(cams: CameraOption[]): string | undefined {
  if (!cams.length) return undefined;
  const back = cams.find((c) => /back|rear|environment|trasera|posterior/i.test(c.label));
  return (back ?? cams[cams.length - 1]).id;
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

export default function Scanner() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { hasPermission } = usePermissions();
  const { label: locationLabel } = useLocations();
  const canEdit = (user?.role === 'ADMIN' || user?.role === 'MANAGER') && hasPermission('inventory.edit');

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isStartingRef = useRef(false);

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

  const lookup = useCallback(
    async (code: string) => {
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
    },
    []
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
      isStartingRef.current = true;
      try {
        // Enumerar cámaras (también solicita el permiso). Sirve para webcams de PC/portátil y para elegir cámara.
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
          formatsToSupport: [
            Html5QrcodeSupportedFormats.QR_CODE,
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.CODE_93,
            Html5QrcodeSupportedFormats.CODABAR,
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
            Html5QrcodeSupportedFormats.ITF,
            Html5QrcodeSupportedFormats.DATA_MATRIX,
          ],
        });
        scannerRef.current = html5;
        // Si hay un id de cámara se usa; si no (sin permiso de enumerar), se cae a facingMode.
        const cameraSource: string | { facingMode: string } = camId ?? { facingMode: 'environment' };
        await html5.start(
          cameraSource,
          {
            fps: 10,
            qrbox: (viewW: number, viewH: number) => {
              const min = Math.min(viewW, viewH);
              const width = Math.floor(min * 0.8);
              return { width, height: Math.floor(width * 0.65) };
            },
          },
          async (decodedText) => {
            await stopCamera();
            await lookup(decodedText.trim());
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
    [secureContext, cameras, selectedCameraId, stopCamera, lookup]
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
    return () => {
      void stopCamera();
    };
  }, [stopCamera]);

  // Al cambiar el equipo, reflejar si ya está en el carrito de traslado.
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
          Apunta la cámara (del celular o webcam del computador) al código QR o al número de serie
          (código de barras) del equipo.
        </p>
      </div>

      {/* Visor de cámara */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="relative bg-black aspect-[4/3] flex items-center justify-center">
          <div id={READER_ID} className="w-full h-full [&_video]:h-full [&_video]:w-full [&_video]:object-cover" />
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

      {/* Resultado: equipo encontrado */}
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

          {/* Cambio rápido de estado */}
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

          {/* Carrito de traslado */}
          <div className="p-4 border-t border-border">
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
                  <ShoppingCart className="h-4 w-4 mr-2" /> Agregar al carrito de traslado
                </>
              )}
            </Button>
          </div>

          {/* Acciones */}
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

      {/* Resultado: no encontrado */}
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
    </motion.div>
  );
}
