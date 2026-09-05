import { useCallback, useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Camera, CameraOff, Flashlight, FlashlightOff, Loader2, SwitchCamera } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  getVideoTrackFromReader,
  pickPreferredScanCamera,
  setTrackTorch,
  trackSupportsTorch,
  waitForTorchSupport,
} from '@/lib/cameraTorch';
import { cn } from '@/lib/utils';

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

/** Ventana horizontal tipo “láser”: ancha y baja, alineada con el overlay visual. */
function barcodeScanBox(viewW: number, viewH: number) {
  const width = Math.floor(Math.min(viewW * 0.88, viewW - 24));
  const height = Math.floor(Math.min(Math.max(viewH * 0.16, 96), 132));
  return { width, height };
}

const VIDEO_CONSTRAINTS_BASE = {
  width: { min: 640, ideal: 1280 },
  height: { min: 480, ideal: 720 },
};

interface BarcodeScannerProps {
  readerId: string;
  active: boolean;
  onScan: (code: string) => void | Promise<void>;
  className?: string;
  /** Evita reenviar el mismo código durante este tiempo (ms). Default 650. */
  sameCodeCooldownMs?: number;
  /** Pausa mínima entre dos códigos distintos (ms). Default 180. */
  betweenCodesMs?: number;
  hint?: string;
}

export default function BarcodeScanner({
  readerId,
  active,
  onScan,
  className,
  sameCodeCooldownMs = 650,
  betweenCodesMs = 180,
  hint = 'Por favor ubica el código de barras del producto dentro de la zona de escáner',
}: BarcodeScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isStartingRef = useRef(false);
  const lastScanRef = useRef<{ code: string; at: number } | null>(null);
  const onScanRef = useRef(onScan);
  const cooldownRef = useRef(sameCodeCooldownMs);
  const betweenRef = useRef(betweenCodesMs);
  const camerasRef = useRef<{ id: string; label: string }[]>([]);
  const selectedCameraIdRef = useRef<string | null>(null);
  onScanRef.current = onScan;
  cooldownRef.current = sameCodeCooldownMs;
  betweenRef.current = betweenCodesMs;

  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameras, setCameras] = useState<{ id: string; label: string }[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchCameraIds, setTorchCameraIds] = useState<Set<string>>(() => new Set());
  const [flashOk, setFlashOk] = useState(false);

  camerasRef.current = cameras;
  selectedCameraIdRef.current = selectedCameraId;

  const secureContext =
    typeof window !== 'undefined' &&
    (window.isSecureContext || location.hostname === 'localhost' || location.hostname === '127.0.0.1');

  const stopCamera = useCallback(async () => {
    const track = getVideoTrackFromReader(readerId);
    if (track) await setTrackTorch(track, false);
    const inst = scannerRef.current;
    if (!inst) {
      setScanning(false);
      setTorchOn(false);
      setTorchSupported(false);
      return;
    }
    try {
      if (inst.isScanning) await inst.stop();
      inst.clear();
    } catch {
      /* ignore */
    }
    scannerRef.current = null;
    setScanning(false);
    setTorchOn(false);
    setTorchSupported(false);
  }, [readerId]);

  const startCamera = useCallback(
    async (cameraId?: string) => {
      const alreadyRunning = scannerRef.current !== null;
      if (isStartingRef.current || alreadyRunning || !active) return;
      if (!secureContext) {
        setCameraError('La cámara requiere HTTPS o localhost.');
        return;
      }
      setCameraError(null);
      lastScanRef.current = null;
      isStartingRef.current = true;
      try {
        let cams = camerasRef.current;
        if (!cams.length) {
          try {
            const found = await Html5Qrcode.getCameras();
            cams = found.map((c) => ({ id: c.id, label: c.label || 'Cámara' }));
            camerasRef.current = cams;
            setCameras(cams);
          } catch {
            cams = [];
          }
        }
        const camId = cameraId ?? selectedCameraIdRef.current ?? pickPreferredScanCamera(cams);
        if (camId) {
          selectedCameraIdRef.current = camId;
          setSelectedCameraId(camId);
        }

        const html5 = new Html5Qrcode(readerId, {
          verbose: false,
          formatsToSupport: BARCODE_FORMATS,
          experimentalFeatures: { useBarCodeDetectorIfSupported: true },
        });
        scannerRef.current = html5;

        await html5.start(
          camId ?? { facingMode: { ideal: 'environment' }, ...VIDEO_CONSTRAINTS_BASE },
          {
            fps: 45,
            qrbox: barcodeScanBox,
            disableFlip: false,
            videoConstraints: camId
              ? { deviceId: { exact: camId }, ...VIDEO_CONSTRAINTS_BASE }
              : { facingMode: { ideal: 'environment' }, ...VIDEO_CONSTRAINTS_BASE },
          },
          (decodedText) => {
            const code = decodedText.trim();
            if (!code) return;
            const now = Date.now();
            const prev = lastScanRef.current;
            if (prev) {
              const gap = now - prev.at;
              if (prev.code === code && gap < cooldownRef.current) return;
              if (prev.code !== code && gap < betweenRef.current) return;
            }
            lastScanRef.current = { code, at: now };
            setFlashOk(true);
            window.setTimeout(() => setFlashOk(false), 280);
            void onScanRef.current(code);
          },
          () => {}
        );
        setScanning(true);
        setTorchOn(false);

        const hasTorch = await waitForTorchSupport(readerId);
        setTorchSupported(hasTorch);
        if (hasTorch && camId) {
          setTorchCameraIds((prev) => {
            if (prev.has(camId)) return prev;
            const next = new Set(prev);
            next.add(camId);
            return next;
          });
        }
      } catch (err) {
        scannerRef.current = null;
        const msg = err instanceof Error ? err.message : String(err);
        setCameraError(/permission|denied/i.test(msg) ? 'Permiso de cámara denegado.' : 'No se pudo iniciar la cámara.');
      } finally {
        isStartingRef.current = false;
      }
    },
    [active, secureContext, readerId]
  );

  const toggleTorch = async () => {
    const track = getVideoTrackFromReader(readerId);
    if (!trackSupportsTorch(track) || !track) {
      setTorchSupported(false);
      return;
    }
    const next = !torchOn;
    const ok = await setTrackTorch(track, next);
    if (ok) setTorchOn(next);
  };

  useEffect(() => {
    if (active) void startCamera();
    else void stopCamera();
    return () => {
      void stopCamera();
    };
  }, [active, startCamera, stopCamera]);

  const switchCamera = async (id: string) => {
    await stopCamera();
    await startCamera(id);
  };

  return (
    <div className={cn('bg-card rounded-xl border border-border overflow-hidden', className)}>
      <div className="relative bg-black min-h-[min(68vh,560px)] h-[min(68vh,560px)] flex items-center justify-center overflow-hidden">
        {/* Video a pantalla completa; ocultamos el sombreado nativo de html5-qrcode */}
        <div
          id={readerId}
          className={cn(
            'absolute inset-0 w-full h-full',
            '[&_video]:!absolute [&_video]:!inset-0 [&_video]:!h-full [&_video]:!w-full [&_video]:!object-cover [&_video]:!max-w-none',
            '[&_img]:hidden',
            '[&_#qr-shaded-region]:!hidden [&_[id*="qr-shaded-region"]]:!hidden',
            '[&_canvas]:hidden'
          )}
        />

        {/* Visor: máscara oscura + ventana central (estilo app de inventario rápido) */}
        {scanning && (
          <div className="absolute inset-0 z-10 pointer-events-none flex flex-col items-center justify-center px-4">
            <p className="mb-5 max-w-[20rem] text-center text-[15px] leading-snug font-medium text-white drop-shadow-md">
              {hint}
            </p>
            <div
              className={cn(
                'relative w-[min(88%,340px)] h-[112px] rounded-2xl border-2 transition-colors duration-200',
                flashOk
                  ? 'border-green-400 shadow-[0_0_0_9999px_rgba(0,0,0,0.55),0_0_24px_rgba(74,222,128,0.55)]'
                  : 'border-white/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.55)]'
              )}
            >
              {/* Esquinas de guía */}
              <span className="absolute -top-0.5 -left-0.5 h-5 w-5 border-t-[3px] border-l-[3px] border-white rounded-tl-xl" />
              <span className="absolute -top-0.5 -right-0.5 h-5 w-5 border-t-[3px] border-r-[3px] border-white rounded-tr-xl" />
              <span className="absolute -bottom-0.5 -left-0.5 h-5 w-5 border-b-[3px] border-l-[3px] border-white rounded-bl-xl" />
              <span className="absolute -bottom-0.5 -right-0.5 h-5 w-5 border-b-[3px] border-r-[3px] border-white rounded-br-xl" />
              {/* Línea de lectura */}
              <span
                className={cn(
                  'absolute left-3 right-3 top-1/2 -translate-y-1/2 h-0.5 rounded-full',
                  flashOk ? 'bg-green-400' : 'bg-red-500/80'
                )}
              />
            </div>
          </div>
        )}

        {!scanning && !cameraError && active && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/50">
            <Loader2 className="h-8 w-8 text-primary animate-spin" />
          </div>
        )}
        {!active && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60">
            <CameraOff className="h-10 w-10 text-muted" />
          </div>
        )}
        {cameraError && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 p-4 text-center bg-black/80">
            <CameraOff className="h-10 w-10 text-red-400" />
            <p className="text-sm text-red-300">{cameraError}</p>
            <Button size="sm" variant="outline" onClick={() => startCamera()}>
              <Camera className="h-4 w-4 mr-2" /> Reintentar
            </Button>
          </div>
        )}

        {scanning && (torchSupported || cameras.length > 1) && (
          <div className="absolute bottom-3 left-0 right-0 z-20 flex flex-wrap items-center justify-center gap-2 px-3 pointer-events-auto">
            {torchSupported && (
              <Button
                type="button"
                variant={torchOn ? 'default' : 'secondary'}
                size="sm"
                onClick={() => void toggleTorch()}
                className="min-h-touch bg-black/55 text-white border-white/20 hover:bg-black/70"
                aria-pressed={torchOn}
                aria-label={torchOn ? 'Apagar flash' : 'Encender flash'}
              >
                {torchOn ? <Flashlight className="h-4 w-4 mr-2" /> : <FlashlightOff className="h-4 w-4 mr-2" />}
                {torchOn ? 'Apagar flash' : 'Flash'}
              </Button>
            )}
            {cameras.length > 1 && (
              <div className="relative flex items-center">
                <SwitchCamera className="absolute left-2 h-4 w-4 text-white/80 pointer-events-none" />
                <select
                  value={selectedCameraId ?? ''}
                  onChange={(e) => switchCamera(e.target.value)}
                  className="h-9 pl-8 pr-2 rounded-md bg-black/55 border border-white/20 text-xs text-white max-w-[200px]"
                >
                  {cameras.map((c, i) => (
                    <option key={c.id} value={c.id} className="text-foreground">
                      {(c.label || `Cámara ${i + 1}`) + (torchCameraIds.has(c.id) ? ' · flash' : '')}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
