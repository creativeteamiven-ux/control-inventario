const STORAGE_KEY = 'soundvault_build_event_id';

export function getBuildEventId(): string | null {
  try {
    return sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setBuildEventId(id: string | null): void {
  try {
    if (id) sessionStorage.setItem(STORAGE_KEY, id);
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
