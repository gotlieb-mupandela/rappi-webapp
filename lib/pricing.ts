/**
 * Catalog retail pricing from Joma EUR wholesale/cost.
 *
 * Historical import (commit e390efd): NAD = round(EUR × FX × (1 + 0.67)).
 * Current target markup: 45%.
 */
export const EUR_TO_NAD_FX = 18;
export const RETAIL_MARKUP = 0.45;
/** Markup baked into data/products.json at B2B import. */
export const LEGACY_RETAIL_MARKUP = 0.67;

export function retailNadFromEur(
  eurCost: number,
  markup: number = RETAIL_MARKUP,
  fx: number = EUR_TO_NAD_FX,
) {
  const eur = Number(eurCost) || 0;
  if (eur <= 0) return 0;
  return Math.round(eur * fx * (1 + markup));
}

/** Recover EUR cost implied by a legacy 67% NAD sell price. */
export function eurFromLegacyRetailNad(
  nad: number,
  markup: number = LEGACY_RETAIL_MARKUP,
  fx: number = EUR_TO_NAD_FX,
) {
  const price = Number(nad) || 0;
  if (price <= 0) return 0;
  return price / (fx * (1 + markup));
}

export function isFixedBibPackPrice(code: string, price: number) {
  return /^101686\./i.test(code) && price === 900;
}
