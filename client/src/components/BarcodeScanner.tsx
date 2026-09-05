import { useCallback, useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Camera, CameraOff, Flashlight, FlashlightOff, Loader2, SwitchCamera } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  applyScanFocusHints,
  getVideoTrackFromReader,
  hardenVideoForIOS,
  isAppleMobile,
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

/**
 * Ventana de lectura.
 * En iOS el decodificador JS es más lento/impreciso: zona un poco más alta ayuda al enfoque.
 */
function barcodeScanBox(viewW: number, viewH: number) {
  const apple = isAppleMobile();
  const width = Math.floor(Math.min(viewW * (apple ? 0.92 : 0.88), viewW - 16));
  const height = Math.floor(
    Math.min(Math.max(viewH * (apple ? 0.22 : 0.16), apple ? 110 : 96), apple ? 160 : 132)
  );
  return { width, height };
}

function videoConstraintsFor(camId: string | undefined, apple: boolean): MediaTrackConstraints {
  // iOS: facingMode es más fiable que deviceId exact; resolución ideal más baja = menos carga al ZXing JS
  if (apple) {
    return {
      facingMode: { ideal: 'environment' },
      width: { ideal: 1280 },
      height: { ideal: 720 },
    };
  }
  if (camId) {
    return {
      deviceId: { exact: camId },
      width: { min: 640, ideal: 1280 },
      height: { min: 480, ideal: 720 },
    };
  }
  return {
    facingMode: { ideal: 'environment' },
    width: { min: 640, ideal: 1280 },
    height: { min: 480, ideal: 720 },
  };
}

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
      const apple = isAppleMobile();
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

        // En iOS el BarcodeDetector nativo falla mucho con CODE128/39: mejor el motor JS de html5-qrcode.
        // En Android Chrome el BarcodeDetector es excelente.
        const html5 = new Html5Qrcode(readerId, {
          verbose: false,
          formatsToSupport: BARCODE_FORMATS,
          experimentalFeatures: { useBarCodeDetectorIfSupported: !apple },
        });
        scannerRef.current = html5;

        const constraints = videoConstraintsFor(
          apple && !cameraId ? undefined : camId ?? undefined,
          apple
        );

        // iOS: preferir facingMode como fuente de cámara (deviceId exact suele fallar o elegir ultrawide)
        const cameraSource: string | MediaTrackConstraints =
          apple && !cameraId
            ? { facingMode: { ideal: 'environment' } }
            : apple && cameraId
              ? cameraId
              : camId ?? { facingMode: { ideal: 'environment' } };

        await html5.start(
          cameraSource,
          {
            // iOS: menos fps = más tiempo por frame para el decodificador JS
            fps: apple ? 12 : 30,
            qrbox: barcodeScanBox,
            disableFlip: false,
            videoConstraints: constraints,
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

        hardenVideoForIOS(readerId);
        // Pequeña espera para que el track esté listo antes de pedir foco
        window.setTimeout(() => {
          hardenVideoForIOS(readerId);
          void applyScanFocusHints(readerId);
        }, apple ? 600 : 300);

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

  const apple = typeof navigator !== 'undefined' && isAppleMobile();

  return (
    <div className={cn('bg-card rounded-xl border border-border overflow-hidden', className)}>
      <div className="relative bg-black min-h-[min(68vh,560px)] h-[min(68vh,560px)] flex items-center justify-center overflow-hidden">
        {/*
          Importante: NO ocultar canvas — en iPhone el decodificador JS dibuja ahí.
          Solo ocultamos el sombreado nativo y la imagen de placeholder.
        */}
        <div
          id={readerId}
          className={cn(
            'absolute inset-0 w-full h-full',
            '[&_video]:!absolute [&_video]:!inset-0 [&_video]:!h-full [&_video]:!w-full [&_video]:!object-cover [&_video]:!max-w-none',
            '[&_img]:hidden',
            '[&_#qr-shaded-region]:!hidden [&_[id*="qr-shaded-region"]]:!hidden',
            // canvas fuera de vista pero con tamaño (necesario en Safari)
            '[&_canvas]:!absolute [&_canvas]:!opacity-0 [&_canvas]:!pointer-events-none'
          )}
        />

        {scanning && (
          <div className="absolute inset-0 z-10 pointer-events-none flex flex-col items-center justify-center px-4">
            <p className="mb-5 max-w-[20rem] text-center text-[15px] leading-snug font-medium text-white drop-shadow-md">
              {hint}
            </p>
            <div
              className={cn(
                'relative w-[min(92%,360px)] rounded-2xl border-2 transition-colors duration-200',
                apple ? 'h-[140px]' : 'h-[112px]',
                flashOk
                  ? 'border-green-400 shadow-[0_0_0_9999px_rgba(0,0,0,0.55),0_0_24px_rgba(74,222,128,0.55)]'
                  : 'border-white/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.55)]'
              )}
            >
              <span className="absolute -top-0.5 -left-0.5 h-5 w-5 border-t-[3px] border-l-[3px] border-white rounded-tl-xl" />
              <span className="absolute -top-0.5 -right-0.5 h-5 w-5 border-t-[3px] border-r-[3px] border-white rounded-tr-xl" />
              <span className="absolute -bottom-0.5 -left-0.5 h-5 w-5 border-b-[3px] border-l-[3px] border-white rounded-bl-xl" />
              <span className="absolute -bottom-0.5 -right-0.5 h-5 w-5 border-b-[3px] border-r-[3px] border-white rounded-br-xl" />
              <span
                className={cn(
                  'absolute left-3 right-3 top-1/2 -translate-y-1/2 h-0.5 rounded-full',
                  flashOk ? 'bg-green-400' : 'bg-red-500/80'
                )}
              />
            </div>
            {apple && (
              <p className="mt-4 max-w-[18rem] text-center text-xs text-white/75">
                En iPhone acerca el código y manténlo estable un segundo
              </p>
            )}
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

        {scanning && (torchSupported || (!apple && cameras.length > 1)) && (
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
            {!apple && cameras.length > 1 && (
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
