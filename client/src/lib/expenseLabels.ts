export const EXPENSE_CATEGORIES = [
  { value: 'PURCHASE', label: 'Compra de equipo' },
  { value: 'REPAIR', label: 'Reparación' },
  { value: 'MAINTENANCE', label: 'Mantenimiento / servicio' },
  { value: 'ACCESSORY', label: 'Accesorios / consumibles' },
  { value: 'RENTAL', label: 'Alquiler' },
  { value: 'SERVICE', label: 'Servicios (software, suscripciones)' },
  { value: 'OTHER', label: 'Otro' },
] as const;

export const CURRENCIES = [
  { value: 'COP', label: 'COP (Peso colombiano)' },
  { value: 'USD', label: 'USD (Dólar)' },
] as const;

const CATEGORY_MAP = Object.fromEntries(EXPENSE_CATEGORIES.map((c) => [c.value, c.label]));

export function expenseCategoryLabel(value: string): string {
  return CATEGORY_MAP[value] ?? value;
}

export function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency,
      maximumFractionDigits: currency === 'COP' ? 0 : 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString('es-CO')}`;
  }
}
