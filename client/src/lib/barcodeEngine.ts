import { scanImageData } from '@undecaf/zbar-wasm';
import { isAppleMobile } from './cameraTorch';

type Detector = {
  detect: (source: HTMLCanvasElement | HTMLVideoElement) => Promise<Array<{ rawValue: string }>>;
};

let detectorPromise: Promise<Detector> | null = null;

function hasNativeBarcodeDetector(): boolean {
  if (isAppleMobile()) return false;
  try {
    return typeof (window as unknown as { BarcodeDetector?: unknown }).BarcodeDetector === 'function';
  } catch {
    return false;
  }
}

function canvasToImageData(canvas: HTMLCanvasElement): ImageData | null {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx || !canvas.width || !canvas.height) return null;
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

/** Motor ZBar WASM — fiable en iPhone/Safari para CODE128. */
function createZbarDetector(): Detector {
  return {
    async detect(source) {
      let imageData: ImageData | null = null;
      if (source instanceof HTMLCanvasElement) {
        imageData = canvasToImageData(source);
      } else if (source instanceof HTMLVideoElement) {
        const c = document.createElement('canvas');
        c.width = source.videoWidth;
        c.height = source.videoHeight;
        const ctx = c.getContext('2d');
        if (!ctx || !c.width) return [];
        ctx.drawImage(source, 0, 0);
        imageData = ctx.getImageData(0, 0, c.width, c.height);
      }
      if (!imageData) return [];
      const symbols = await scanImageData(imageData);
      return symbols
        .map((s) => {
          try {
            return { rawValue: s.decode() };
          } catch {
            return { rawValue: '' };
          }
        })
        .filter((s) => s.rawValue);
    },
  };
}

/** Detector nativo (Android) o ZBar WASM (iPhone / fallback). */
export async function getBarcodeDetector(): Promise<Detector> {
  if (detectorPromise) return detectorPromise;
  detectorPromise = (async () => {
    if (hasNativeBarcodeDetector()) {
      try {
        const Native = (
          window as unknown as {
            BarcodeDetector: new (o?: { formats?: string[] }) => {
              detect: (s: ImageBitmapSource) => Promise<Array<{ rawValue: string }>>;
            };
          }
        ).BarcodeDetector;
        const native = new Native({
          formats: ['code_128', 'code_39', 'ean_13', 'ean_8', 'upc_a', 'upc_e', 'itf', 'codabar'],
        });
        return {
          async detect(source) {
            return native.detect(source);
          },
        };
      } catch {
        /* ZBar */
      }
    }
    // Precarga WASM (falla temprano si no se encuentra zbar.wasm)
    await scanImageData(new ImageData(8, 8)).catch(() => undefined);
    return createZbarDetector();
  })();
  return detectorPromise;
}

export function scanVideoConstraints(): MediaTrackConstraints {
  if (isAppleMobile()) {
    return {
      facingMode: { ideal: 'environment' },
      width: { ideal: 1920 },
      height: { ideal: 1080 },
    };
  }
  return {
    facingMode: { ideal: 'environment' },
    width: { min: 640, ideal: 1280 },
    height: { min: 480, ideal: 720 },
  };
}

/**
 * Recorta la franja central del video (zona del visor).
 * En iOS mejora CODE128 al reducir ruido de fondo para ZBar.
 */
export function grabScanRegion(video: HTMLVideoElement, canvas: HTMLCanvasElement): boolean {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) return false;

  const apple = isAppleMobile();
  const regionW = Math.floor(vw * (apple ? 0.94 : 0.88));
  const regionH = Math.floor(Math.min(vh * (apple ? 0.32 : 0.22), apple ? 320 : 220));
  const sx = Math.floor((vw - regionW) / 2);
  const sy = Math.floor((vh - regionH) / 2);

  canvas.width = regionW;
  canvas.height = regionH;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return false;
  ctx.drawImage(video, sx, sy, regionW, regionH, 0, 0, regionW, regionH);
  return true;
}

export function scanSourceFromVideo(video: HTMLVideoElement, canvas: HTMLCanvasElement): HTMLCanvasElement | null {
  return grabScanRegion(video, canvas) ? canvas : null;
}
