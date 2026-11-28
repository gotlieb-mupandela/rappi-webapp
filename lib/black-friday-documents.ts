import "server-only";

import { blackFridayOffer, type BlackFridayOffer } from "@/lib/black-friday";
import { getProductByCode } from "@/lib/offline-catalog";

/**
 * Black Friday offer for a saved quotation or order, worked out from its
 * item codes, prices and the date it was made, so a PDF downloaded again
 * later shows the same gifts and discounts.
 */
export function documentOffer(
  items: { code: string; qty: number; unitPrice: number }[],
  madeAt: string,
  promotions = true,
): BlackFridayOffer {
  if (!promotions) return { gifts: [], discounts: [], discountTotal: 0 };
  const lines = items.flatMap((item) => {
    const product = getProductByCode(item.code);
    if (!product) return [];
    return [
      {
        code: item.code,
        qty: item.qty,
        price: item.unitPrice,
        name: product.name,
        category: product.category,
        subcategory: product.subcategory,
      },
    ];
  });
  return blackFridayOffer(lines, Date.parse(madeAt));
}

/** Layby orders are sold at normal prices: no Black Friday gifts or discounts (Terms clause 7). */
export function isLaybyOrderNotes(notes: string | null | undefined) {
  return /\bLAYBY LB-[A-Z0-9]+/.test(notes ?? "");
}
