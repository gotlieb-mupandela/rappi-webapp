/**
 * Retail NAD from a supplier USD figure.
 * NAD = round(usd * 18 * 1.45). The same rounding the catalog already uses.
 * Offer price wins over list price. Callers decide pack USD vs unit USD.
 */
export const SUPPLIER_FX = 18;
export const SUPPLIER_MARKUP = 0.45;

export function retailNadFromSupplierUsd(
  usd,
  markup = SUPPLIER_MARKUP,
  fx = SUPPLIER_FX,
) {
  const amount = Number(usd);
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  return Math.round(amount * fx * (1 + markup));
}

/** Offer when it is a positive number, otherwise list. Missing both is null. */
export function supplierUsd(offer, list) {
  const offerN = Number(offer);
  if (Number.isFinite(offerN) && offerN > 0) return offerN;
  const listN = Number(list);
  if (Number.isFinite(listN) && listN > 0) return listN;
  return null;
}
