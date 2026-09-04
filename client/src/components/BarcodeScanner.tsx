import { useCallback, useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Camera, CameraOff, Flashlight, FlashlightOff, Loader2, SwitchCamera } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getVideoTrackFromReader, setTrackTorch, trackSupportsTorch } from '@/lib/cameraTorch';
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

function pickDefaultCamera(cams: { id: string; label: string }[]) {
  if (!cams.length) return undefined;
  const back = cams.find((c) => /back|rear|environment|trasera|posterior/i.test(c.label));
  return (back ?? cams[cams.length - 1]).id;
}

function barcodeScanBox(viewW: number, viewH: number) {
  return { width: Math.floor(viewW * 0.92), height: Math.floor(Math.min(viewH * 0.32, 140)) };
}

interface BarcodeScannerProps {
  readerId: string;
  active: boolean;
  onScan: (code: string) => void | Promise<void>;
  className?: string;
}

export default function BarcodeScanner({ readerId, active, onScan, className }: BarcodeScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isStartingRef = useRef(false);
  const lastScanRef = useRef<{ code: string; at: number } | null>(null);
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameras, setCameras] = useState<{ id: string; label: string }[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);

  const secureContext =
    typeof window !== 'undefined' &&
    (window.isSecureContext || location.hostname === 'localhost' || location.hostname === '127.0.0.1');

  const refreshTorchSupport = useCallback(() => {
    const track = getVideoTrackFromReader(readerId);
    const ok = trackSupportsTorch(track);
    setTorchSupported(ok);
    if (!ok) setTorchOn(false);
  }, [readerId]);

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
      if (isStartingRef.current || scannerRef.current || !active) return;
      if (!secureContext) {
        setCameraError('La cámara requiere HTTPS o localhost.');
        return;
      }
      setCameraError(null);
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

        const html5 = new Html5Qrcode(readerId, {
          verbose: false,
          formatsToSupport: BARCODE_FORMATS,
          experimentalFeatures: { useBarCodeDetectorIfSupported: true },
        });
        scannerRef.current = html5;

        await html5.start(
          camId ?? { facingMode: { ideal: 'environment' }, width: { min: 640, ideal: 1920 }, height: { min: 480, ideal: 1080 } },
          {
            fps: 20,
            qrbox: barcodeScanBox,
            disableFlip: false,
            videoConstraints: camId
              ? { deviceId: { exact: camId }, width: { min: 640, ideal: 1920 }, height: { min: 480, ideal: 1080 } }
              : { facingMode: { ideal: 'environment' }, width: { min: 640, ideal: 1920 }, height: { min: 480, ideal: 1080 } },
          },
          (decodedText) => {
            const code = decodedText.trim();
            if (!code) return;
            const now = Date.now();
            const prev = lastScanRef.current;
            if (prev && prev.code === code && now - prev.at < 1500) return;
            lastScanRef.current = { code, at: now };
            void onScanRef.current(code);
          },
          () => {}
        );
        setScanning(true);
        setTorchOn(false);
        // Capacidades torch suelen estar listas tras un frame
        requestAnimationFrame(() => refreshTorchSupport());
        setTimeout(refreshTorchSupport, 400);
      } catch (err) {
        scannerRef.current = null;
        const msg = err instanceof Error ? err.message : String(err);
        setCameraError(/permission|denied/i.test(msg) ? 'Permiso de cámara denegado.' : 'No se pudo iniciar la cámara.');
      } finally {
        isStartingRef.current = false;
      }
    },
    [active, secureContext, cameras, selectedCameraId, readerId, refreshTorchSupport]
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
    setSelectedCameraId(id);
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
                className="h-8 pl-8 pr-2 rounded-md bg-card border border-border text-xs max-w-[180px]"
              >
                {cameras.map((c, i) => (
                  <option key={c.id} value={c.id}>
                    {c.label || `Cámara ${i + 1}`}
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
