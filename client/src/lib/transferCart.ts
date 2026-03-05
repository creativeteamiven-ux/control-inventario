import type { CartDevice } from '@/components/TransferCart';

const STORAGE_KEY = 'soundvault_transfer_cart';

export function getStoredCart(): CartDevice[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function addToStoredCart(device: CartDevice): void {
  const cart = getStoredCart();
  if (cart.some((d) => d.id === device.id)) return;
  cart.push(device);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
}

export function addManyToStoredCart(devices: CartDevice[]): number {
  const cart = getStoredCart();
  const ids = new Set(cart.map((d) => d.id));
  let added = 0;
  for (const d of devices) {
    if (!ids.has(d.id)) {
      cart.push(d);
      ids.add(d.id);
      added++;
    }
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
  return added;
}

export function clearStoredCart(): void {
  localStorage.removeItem(STORAGE_KEY);
}
