import { describe, it, expect } from 'vitest';
import { computeDepreciation, DEFAULT_USEFUL_LIFE_YEARS } from './depreciation.js';

describe('computeDepreciation', () => {
  it('devuelve valores neutros cuando no hay precio ni fecha', () => {
    const r = computeDepreciation(null, null, null);
    expect(r.bookValue).toBeNull();
    expect(r.accumulatedDepreciation).toBe(0);
    expect(r.usefulLifeYears).toBe(DEFAULT_USEFUL_LIFE_YEARS);
  });

  it('un equipo nuevo conserva casi todo su valor', () => {
    const now = new Date('2026-01-01');
    const purchase = new Date('2026-01-01');
    const r = computeDepreciation(1000, purchase, 5, now);
    expect(r.bookValue).toBe(1000);
    expect(r.accumulatedDepreciation).toBe(0);
    expect(r.fullyDepreciated).toBe(false);
  });

  it('deprecia linealmente a la mitad de la vida útil', () => {
    const purchase = new Date('2021-01-01');
    const now = new Date('2023-07-02'); // ~2.5 años
    const r = computeDepreciation(1000, purchase, 5, now);
    expect(r.bookValue).toBeGreaterThan(450);
    expect(r.bookValue).toBeLessThan(550);
  });

  it('nunca baja de 0 y marca totalmente depreciado', () => {
    const purchase = new Date('2010-01-01');
    const now = new Date('2026-01-01');
    const r = computeDepreciation(1000, purchase, 5, now);
    expect(r.bookValue).toBe(0);
    expect(r.fullyDepreciated).toBe(true);
    expect(r.accumulatedDepreciation).toBe(1000);
  });

  it('usa la vida útil por defecto si la categoría no la define', () => {
    const r = computeDepreciation(500, new Date('2025-01-01'), null, new Date('2026-01-01'));
    expect(r.usefulLifeYears).toBe(DEFAULT_USEFUL_LIFE_YEARS);
  });
});
