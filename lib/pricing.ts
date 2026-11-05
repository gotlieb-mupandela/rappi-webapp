/**
 * Catalog retail pricing from the supplier wholesale figure.
 *
 * Historical import (commit e390efd): NAD = round(EUR x FX x (1 + 0.67)).
 * Current rule: NAD = round(usd x 18 x 1.45). Offer wins over list.
 * The implementation lives in lib/retail-nad.mjs so scripts share it.
 */
import { retailNadFromSupplierUsd, SUPPLIER_FX, SUPPLIER_MARKUP } from "./retail-nad.mjs";

export const EUR_TO_NAD_FX = SUPPLIER_FX;
export const RETAIL_MARKUP = SUPPLIER_MARKUP;
/** Markup baked into data/products.json at B2B import. */
export const LEGACY_RETAIL_MARKUP = 0.67;

export function retailNadFromEur(
  eurCost: number,
  markup: number = RETAIL_MARKUP,
  fx: number = EUR_TO_NAD_FX,
) {
  return retailNadFromSupplierUsd(eurCost, markup, fx);
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
  return /^101686\./i.test(code) && price === 783;
}
