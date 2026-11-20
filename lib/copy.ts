import type { Product } from "@/lib/types";
import type { Market } from "@/lib/i18n/config";
import type { TFunction } from "@/lib/i18n/translate";
import jomaDescriptions from "@/data/joma-descriptions.json";
import {
  productDescription as describe,
  productHeading,
  productImageAlt,
  type JomaDesc,
} from "@/lib/product-copy";

/**
 * Server-side product copy. Reads data/joma-descriptions.json, so client
 * components must import lib/product-copy.ts instead and receive the row
 * from jomaCopyFor() as a prop.
 */
const JOMA_COPY = jomaDescriptions as Record<string, JomaDesc>;

export function jomaCopyFor(code: string): JomaDesc | null {
  return JOMA_COPY[code] ?? null;
}

export function productDescription(
  product: Product,
  opts?: { t?: TFunction; market?: Market },
): string {
  return describe(product, { ...opts, joma: jomaCopyFor(product.code) });
}

export { productHeading, productImageAlt };
