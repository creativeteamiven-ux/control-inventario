import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, CameraOff, Flashlight, FlashlightOff, Loader2, SwitchCamera } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getBarcodeDetector, scanSourceFromVideo, scanVideoConstraints } from '@/lib/barcodeEngine';
import {
  isAppleMobile,
  pickPreferredScanCamera,
  setTrackTorch,
  trackSupportsTorch,
} from '@/lib/cameraTorch';
import { cn } from '@/lib/utils';

interface BarcodeScannerProps {
  readerId: string;
  active: boolean;
  onScan: (code: string) => void | Promise<void>;
  className?: string;
  sameCodeCooldownMs?: number;
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
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const busyRef = useRef(false);
  const lastScanRef = useRef<{ code: string; at: number } | null>(null);
  const onScanRef = useRef(onScan);
  const cooldownRef = useRef(sameCodeCooldownMs);
  const betweenRef = useRef(betweenCodesMs);
  const aliveRef = useRef(false);

  onScanRef.current = onScan;
  cooldownRef.current = sameCodeCooldownMs;
  betweenRef.current = betweenCodesMs;

  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameras, setCameras] = useState<{ id: string; label: string }[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [flashOk, setFlashOk] = useState(false);
  // iOS exige gesto del usuario para getUserMedia: no auto-iniciar en la primera carga
  const [iosArmed, setIosArmed] = useState(() => !isAppleMobile());

  const secureContext =
    typeof window !== 'undefined' &&
    (window.isSecureContext || location.hostname === 'localhost' || location.hostname === '127.0.0.1');

  const stopLoop = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const stopCamera = useCallback(async () => {
    aliveRef.current = false;
    stopLoop();
    busyRef.current = false;
    const stream = streamRef.current;
    streamRef.current = null;
    if (stream) {
      for (const t of stream.getTracks()) {
        try {
          t.stop();
        } catch {
          /* ignore */
        }
      }
    }
    const video = videoRef.current;
    if (video) {
      video.srcObject = null;
    }
    setScanning(false);
    setTorchOn(false);
    setTorchSupported(false);
  }, [stopLoop]);

  const emitCode = useCallback((raw: string) => {
    const code = raw.trim();
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
  }, []);

  const startLoop = useCallback(async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    let detector;
    try {
      detector = await getBarcodeDetector();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setCameraError(`No se pudo cargar el lector: ${msg}`);
      return;
    }

    const apple = isAppleMobile();
    // iOS: ~8–10 fps de decode (ZBar WASM). Android nativo puede ir más rápido.
    const minGapMs = apple ? 120 : 50;
    let lastAttempt = 0;

    const tick = async (ts: number) => {
      if (!aliveRef.current) return;
      rafRef.current = requestAnimationFrame(tick);

      if (busyRef.current) return;
      if (ts - lastAttempt < minGapMs) return;
      if (video.readyState < 2 || video.paused) return;

      lastAttempt = ts;
      busyRef.current = true;
      try {
        const source = scanSourceFromVideo(video, canvas);
        if (!source) return;
        const codes = await detector.detect(source);
        if (codes?.length) {
          emitCode(codes[0].rawValue);
        }
      } catch {
        /* frame fallido: seguir */
      } finally {
        busyRef.current = false;
      }
    };

    rafRef.current = requestAnimationFrame(tick);
  }, [emitCode]);

  const startCamera = useCallback(
    async (cameraId?: string) => {
      if (!active || !secureContext) {
        if (!secureContext) setCameraError('La cámara requiere HTTPS o localhost.');
        return;
      }
      await stopCamera();
      aliveRef.current = true;
      setCameraError(null);
      lastScanRef.current = null;

      try {
        let cams = cameras;
        if (!cams.length && navigator.mediaDevices?.enumerateDevices) {
          try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            cams = devices
              .filter((d) => d.kind === 'videoinput')
              .map((d, i) => ({ id: d.deviceId, label: d.label || `Cámara ${i + 1}` }));
            setCameras(cams);
          } catch {
            cams = [];
          }
        }

        const apple = isAppleMobile();
        const preferred = cameraId ?? selectedCameraId ?? pickPreferredScanCamera(cams);
        if (preferred) setSelectedCameraId(preferred);

        const base = scanVideoConstraints();
        const constraints: MediaStreamConstraints = {
          audio: false,
          video:
            apple || !preferred
              ? base
              : { ...base, deviceId: { exact: preferred } },
        };

        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia(constraints);
        } catch {
          // Fallback duro para iOS si ideal falla
          stream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: { facingMode: 'environment' },
          });
        }

        if (!aliveRef.current) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        video.setAttribute('playsinline', 'true');
        video.setAttribute('webkit-playsinline', 'true');
        video.muted = true;
        video.playsInline = true;
        video.srcObject = stream;
        await video.play();

        // Re-enumerar tras permiso (iOS da labels)
        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const listed = devices
            .filter((d) => d.kind === 'videoinput')
            .map((d, i) => ({ id: d.deviceId, label: d.label || `Cámara ${i + 1}` }));
          if (listed.length) setCameras(listed);
        } catch {
          /* ignore */
        }

        const track = stream.getVideoTracks()[0] ?? null;
        setTorchSupported(trackSupportsTorch(track));
        setTorchOn(false);
        setScanning(true);
        await startLoop();
      } catch (err) {
        aliveRef.current = false;
        const msg = err instanceof Error ? err.message : String(err);
        setCameraError(
          /permission|denied|notallowed/i.test(msg)
            ? 'Permiso de cámara denegado. Actívalo en Ajustes → Safari.'
            : 'No se pudo iniciar la cámara en este dispositivo.'
        );
        setScanning(false);
      }
    },
    [active, secureContext, stopCamera, cameras, selectedCameraId, startLoop]
  );

  const toggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks()[0] ?? null;
    if (!trackSupportsTorch(track) || !track) {
      setTorchSupported(false);
      return;
    }
    const next = !torchOn;
    const ok = await setTrackTorch(track, next);
    if (ok) setTorchOn(next);
  };

  useEffect(() => {
    if (active && iosArmed) void startCamera();
    else void stopCamera();
    return () => {
      void stopCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo active / iosArmed
  }, [active, iosArmed]);

  const switchCamera = async (id: string) => {
    setSelectedCameraId(id);
    await startCamera(id);
  };

  const apple = typeof navigator !== 'undefined' && isAppleMobile();
  const needsArm = apple && active && !iosArmed && !scanning && !cameraError;

  return (
    <div className={cn('bg-card rounded-xl border border-border overflow-hidden', className)}>
      <div className="relative bg-black min-h-[min(68vh,560px)] h-[min(68vh,560px)] flex items-center justify-center overflow-hidden">
        <video
          ref={videoRef}
          id={readerId}
          className="absolute inset-0 h-full w-full object-cover"
          muted
          playsInline
          autoPlay
        />
        <canvas ref={canvasRef} className="hidden" aria-hidden />

        {scanning && (
          <div className="absolute inset-0 z-10 pointer-events-none flex flex-col items-center justify-center px-4">
            <p className="mb-5 max-w-[20rem] text-center text-[15px] leading-snug font-medium text-white drop-shadow-md">
              {hint}
            </p>
            <div
              className={cn(
                'relative w-[min(92%,360px)] rounded-2xl border-2 transition-colors duration-200',
                apple ? 'h-[150px]' : 'h-[112px]',
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
                Acerca el código a la franja y espera un momento (iPhone)
              </p>
            )}
          </div>
        )}

        {!scanning && !cameraError && active && iosArmed && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/50">
            <Loader2 className="h-8 w-8 text-primary animate-spin" />
          </div>
        )}
        {needsArm && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 p-6 text-center bg-black/75">
            <Camera className="h-12 w-12 text-white/80" />
            <p className="text-sm text-white/90 max-w-xs">
              En iPhone debes activar la cámara con un toque para poder escanear.
            </p>
            <Button
              className="min-h-touch"
              onClick={() => {
                setIosArmed(true);
              }}
            >
              <Camera className="h-4 w-4 mr-2" /> Iniciar cámara
            </Button>
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
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setIosArmed(true);
                void startCamera();
              }}
            >
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
                      {c.label || `Cámara ${i + 1}`}
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
