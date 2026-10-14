import fixData from "@/data/b2c-price-fix-data.json";

/** Pack-policy hidden SKUs (broken / hidden packs, e.g. 700133.100): never shown. */
const DELIBERATELY_HIDDEN = new Set(
  ((fixData as { hidden_packs?: Array<{ code: string }> }).hidden_packs ?? []).map((h) => h.code),
);

type VisProduct = {
  code: string;
  available?: boolean;
  stockQty?: number | null;
  totalQty?: number | null;
  price?: number | null;
};

export function isDeliberatelyHidden(p: Pick<VisProduct, "code">) {
  return DELIBERATELY_HIDDEN.has(p.code);
}

/**
 * Unavailable only because stock is 0: shown in Joma folder listings (portal order)
 * and on its product page as "Sold out", never buyable. The daily stock sync flips
 * `available` back to true when stock returns. Hidden packs, unavailable rows that
 * still carry stock and zero-price stubs stay hidden.
 */
export function isZeroStockVisible(p: VisProduct) {
  if (p.available !== false) return false;
  if (isDeliberatelyHidden(p)) return false;
  const stock = Number(p.stockQty ?? p.totalQty ?? 0);
  if (stock > 0) return false;
  return Number(p.price ?? 0) > 0;
}
