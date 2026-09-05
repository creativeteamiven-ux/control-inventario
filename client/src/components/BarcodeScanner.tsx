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

function barcodeScanBox(viewW: number, viewH: number) {
  // Zona ancha y un poco más alta: más fácil de enganchar el código al pasar rápido
  return { width: Math.floor(viewW * 0.94), height: Math.floor(Math.min(viewH * 0.38, 168)) };
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
}

export default function BarcodeScanner({
  readerId,
  active,
  onScan,
  className,
  sameCodeCooldownMs = 650,
  betweenCodesMs = 180,
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
            fps: 30,
            qrbox: barcodeScanBox,
            disableFlip: false,
            aspectRatio: 1.333,
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
      <div className="relative bg-black aspect-[4/3] flex items-center justify-center">
        <div id={readerId} className="w-full h-full [&_video]:h-full [&_video]:w-full [&_video]:object-cover" />
        {scanning && (
          <div className="absolute bottom-2 left-0 right-0 text-center pointer-events-none">
            <span className="text-xs text-white/80 bg-black/50 px-3 py-1 rounded-full">Alinea el código en el recuadro</span>
          </div>
        )}
        {!scanning && !cameraError && active && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="h-8 w-8 text-primary animate-spin" />
          </div>
        )}
        {!active && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60">
            <CameraOff className="h-10 w-10 text-muted" />
          </div>
        )}
        {cameraError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4 text-center bg-black/80">
            <CameraOff className="h-10 w-10 text-red-400" />
            <p className="text-sm text-red-300">{cameraError}</p>
            <Button size="sm" variant="outline" onClick={() => startCamera()}>
              <Camera className="h-4 w-4 mr-2" /> Reintentar
            </Button>
          </div>
        )}
      </div>
      {scanning && (torchSupported || cameras.length > 1) && (
        <div className="p-2 flex flex-wrap items-center justify-center gap-2 border-t border-border">
          {torchSupported && (
            <Button
              type="button"
              variant={torchOn ? 'default' : 'outline'}
              size="sm"
              onClick={() => void toggleTorch()}
              className="min-h-touch"
              aria-pressed={torchOn}
              aria-label={torchOn ? 'Apagar flash' : 'Encender flash'}
            >
              {torchOn ? <Flashlight className="h-4 w-4 mr-2" /> : <FlashlightOff className="h-4 w-4 mr-2" />}
              {torchOn ? 'Apagar flash' : 'Encender flash'}
            </Button>
          )}
          {cameras.length > 1 && (
            <div className="relative flex items-center">
              <SwitchCamera className="absolute left-2 h-4 w-4 text-muted pointer-events-none" />
              <select
                value={selectedCameraId ?? ''}
                onChange={(e) => switchCamera(e.target.value)}
                className="h-8 pl-8 pr-2 rounded-md bg-card border border-border text-xs max-w-[200px]"
              >
                {cameras.map((c, i) => (
                  <option key={c.id} value={c.id}>
                    {(c.label || `Cámara ${i + 1}`) + (torchCameraIds.has(c.id) ? ' · flash' : '')}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
