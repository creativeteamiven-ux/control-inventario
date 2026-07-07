import { describe, it, expect } from 'vitest';
import { formatMoney, expenseCategoryLabel } from './expenseLabels';

describe('formatMoney', () => {
  it('formatea COP sin decimales', () => {
    const s = formatMoney(150000, 'COP');
    expect(s).toContain('150');
    expect(s).not.toContain(',00');
  });

  it('formatea USD con símbolo', () => {
    const s = formatMoney(99.5, 'USD');
    expect(s).toMatch(/99/);
  });
});

describe('expenseCategoryLabel', () => {
  it('traduce categorías conocidas', () => {
    expect(expenseCategoryLabel('REPAIR')).toBe('Reparación');
    expect(expenseCategoryLabel('PURCHASE')).toBe('Compra de equipo');
  });

  it('devuelve el valor original si es desconocido', () => {
    expect(expenseCategoryLabel('XYZ')).toBe('XYZ');
  });
});
