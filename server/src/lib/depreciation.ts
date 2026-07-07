/**
 * Depreciación lineal (straight-line) y valor en libros.
 * Vida útil por defecto si la categoría no la define.
 */
export const DEFAULT_USEFUL_LIFE_YEARS = 5;

export interface DepreciationResult {
  purchasePrice: number | null;
  purchaseDate: string | null;
  usefulLifeYears: number;
  ageYears: number;
  annualDepreciation: number;
  accumulatedDepreciation: number;
  bookValue: number | null;
  fullyDepreciated: boolean;
}

export function computeDepreciation(
  purchasePrice: number | null,
  purchaseDate: Date | null,
  usefulLifeYears: number | null | undefined,
  now: Date = new Date()
): DepreciationResult {
  const life = usefulLifeYears && usefulLifeYears > 0 ? usefulLifeYears : DEFAULT_USEFUL_LIFE_YEARS;

  if (purchasePrice == null || purchaseDate == null) {
    return {
      purchasePrice: purchasePrice ?? null,
      purchaseDate: purchaseDate ? purchaseDate.toISOString() : null,
      usefulLifeYears: life,
      ageYears: 0,
      annualDepreciation: 0,
      accumulatedDepreciation: 0,
      bookValue: purchasePrice ?? null,
      fullyDepreciated: false,
    };
  }

  const ageMs = Math.max(0, now.getTime() - purchaseDate.getTime());
  const ageYears = ageMs / (365.25 * 24 * 60 * 60 * 1000);
  const annualDepreciation = purchasePrice / life;
  const accumulatedDepreciation = Math.min(purchasePrice, annualDepreciation * ageYears);
  const bookValue = Math.max(0, purchasePrice - accumulatedDepreciation);

  return {
    purchasePrice,
    purchaseDate: purchaseDate.toISOString(),
    usefulLifeYears: life,
    ageYears: Math.round(ageYears * 100) / 100,
    annualDepreciation: Math.round(annualDepreciation * 100) / 100,
    accumulatedDepreciation: Math.round(accumulatedDepreciation * 100) / 100,
    bookValue: Math.round(bookValue * 100) / 100,
    fullyDepreciated: ageYears >= life,
  };
}
