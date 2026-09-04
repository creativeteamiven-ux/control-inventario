/** Control del flash/torch de la cámara (móviles con soporte). */

type TorchCaps = MediaTrackCapabilities & { torch?: boolean };

export function getVideoTrackFromReader(readerId: string): MediaStreamTrack | null {
  const el = document.getElementById(readerId);
  const video = el?.querySelector('video') as HTMLVideoElement | null;
  const stream = video?.srcObject;
  if (!(stream instanceof MediaStream)) return null;
  return stream.getVideoTracks()[0] ?? null;
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
