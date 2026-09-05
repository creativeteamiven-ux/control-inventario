/** Control del flash/torch de la cámara (móviles con soporte). */

type TorchCaps = MediaTrackCapabilities & { torch?: boolean };

export type CameraChoice = { id: string; label: string };

/** iPhone/iPad (Safari o Chrome/Firefox en iOS — todos usan WebKit). */
export function isAppleMobile(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  if (/iPhone|iPad|iPod/i.test(ua)) return true;
  // iPadOS 13+ a veces se reporta como Mac con touch
  return /Macintosh/i.test(ua) && typeof document !== 'undefined' && 'ontouchend' in document;
}

export function getVideoTrackFromReader(readerId: string): MediaStreamTrack | null {
  const el = document.getElementById(readerId);
  const video = el?.querySelector('video') as HTMLVideoElement | null;
  const stream = video?.srcObject;
  if (!(stream instanceof MediaStream)) return null;
  return stream.getVideoTracks()[0] ?? null;
}

/** Atributos críticos para que Safari no pause el video en fullscreen/inline. */
export function hardenVideoForIOS(readerId: string) {
  const el = document.getElementById(readerId);
  const video = el?.querySelector('video') as HTMLVideoElement | null;
  if (!video) return;
  video.setAttribute('playsinline', 'true');
  video.setAttribute('webkit-playsinline', 'true');
  video.muted = true;
  video.playsInline = true;
  void video.play().catch(() => {});
}

/**
 * Tras arrancar, pide foco continuo / zoom suave si el track lo permite.
 * En iOS muchas caps no existen; se ignora el error.
 */
export async function applyScanFocusHints(readerId: string) {
  const track = getVideoTrackFromReader(readerId);
  if (!track || typeof track.applyConstraints !== 'function') return;
  try {
    const caps =
      typeof track.getCapabilities === 'function'
        ? (track.getCapabilities() as MediaTrackCapabilities & {
            focusMode?: string[];
            zoom?: { min: number; max: number };
          })
        : null;
    const advanced: Record<string, unknown>[] = [];
    if (caps?.focusMode?.includes?.('continuous')) {
      advanced.push({ focusMode: 'continuous' });
    }
    if (caps?.zoom && typeof caps.zoom.max === 'number' && caps.zoom.max > 1) {
      const z = Math.min(caps.zoom.max, Math.max(caps.zoom.min ?? 1, 1.5));
      advanced.push({ zoom: z });
    }
    if (!advanced.length) {
      await track.applyConstraints({
        advanced: [{ focusMode: 'continuous' } as unknown as MediaTrackConstraintSet],
      });
      return;
    }
    await track.applyConstraints({ advanced: advanced as unknown as MediaTrackConstraintSet[] });
  } catch {
    /* Safari a menudo no soporta estas constraints */
  }
}

export function trackSupportsTorch(track: MediaStreamTrack | null): boolean {
  if (!track || typeof track.getCapabilities !== 'function') return false;
  try {
    const caps = track.getCapabilities() as TorchCaps;
    return caps.torch === true;
  } catch {
    return false;
  }
}

/** Espera a que el track exponga torch (a veces tarda un frame tras start). */
export async function waitForTorchSupport(readerId: string, timeoutMs = 700): Promise<boolean> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (trackSupportsTorch(getVideoTrackFromReader(readerId))) return true;
    await new Promise((r) => setTimeout(r, 80));
  }
  return trackSupportsTorch(getVideoTrackFromReader(readerId));
}

/**
 * Prioriza la trasera principal (p. ej. "camera 0, facing back"),
 * que es la que suele tener flash; evita ultra-wide / tele / frontal.
 */
export function scoreScanCamera(label: string): number {
  const l = label.toLowerCase();
  let s = 0;
  if (/back|rear|environment|trasera|posterior/.test(l)) s += 20;
  if (/facing\s*back/.test(l)) s += 8;
  if (/\bcamera\s*0\b/.test(l) || /^0[,:\s]/.test(l)) s += 12;
  if (/\b0\b/.test(l) && /back|rear/.test(l)) s += 6;
  if (/front|user|facing\s*front|frontal/.test(l)) s -= 40;
  if (/ultra|wide|tele|macro|depth|tof|infrared|ir\b/.test(l)) s -= 15;
  return s;
}

export function pickPreferredScanCamera(cams: CameraChoice[]): string | undefined {
  if (!cams.length) return undefined;
  return [...cams].sort((a, b) => scoreScanCamera(b.label) - scoreScanCamera(a.label))[0].id;
}

export async function setTrackTorch(track: MediaStreamTrack, on: boolean): Promise<boolean> {
  try {
    await track.applyConstraints({
      advanced: [{ torch: on } as unknown as MediaTrackConstraintSet],
    });
    return true;
  } catch {
    return false;
  }
}
