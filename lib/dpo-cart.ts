import "server-only";

import {
  CartResolveError,
  parseCheckoutLineInput,
  parseQty,
  parseShippingMethod,
  priceCheckoutLines,
} from "@/lib/checkout-lines";
import { merchandiseSubtotal } from "@/lib/checkout-quote";
import type { DpoCartLine } from "@/lib/dpo-payload";
import { shippingCostById } from "@/lib/shipping";
import { getFreshCheckoutProducts } from "@/lib/supabase/catalog";

export { CartResolveError, parseQty, parseShippingMethod };

export async function resolveCheckoutLines(input: unknown): Promise<DpoCartLine[]> {
  const parsed = parseCheckoutLineInput(input);
  const products = await getFreshCheckoutProducts(parsed.map((line) => line.code));
  return priceCheckoutLines(parsed, products);
}

export function cartSubtotal(lines: DpoCartLine[]) {
  return merchandiseSubtotal(lines);
}

export function cartShippingCost(methodId: string) {
  return shippingCostById(methodId);
}

export function cartDescription(lines: DpoCartLine[], companyRef: string) {
  const summary = lines.map((line) => `${line.code}×${line.qty}`).join(", ");
  const text = `${summary} ${companyRef}`.trim();
  return text.length > 180 ? `${text.slice(0, 177)}...` : text;
}
