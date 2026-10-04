import "server-only";

import { SUBCATEGORY_LABELS } from "@/lib/catalog";
import { searchListing } from "@/lib/listing-core";
import {
  categoryCountsFrom,
  getProductByCode,
  offlineCatalog,
  productsByCategory as productsInCategory,
} from "@/lib/offline-catalog";
import type { Product } from "@/lib/types";

export {
  inStockSizes,
  isLowStock,
  totalStock,
} from "@/lib/product-stock";

export { categoryCountsFrom, getProductByCode, productsByCategory } from "@/lib/offline-catalog";

/** Bundled catalog fallback — live data goes through getCatalog(). */
export const products = offlineCatalog;

export function getProduct(code: string, catalog: Product[] = products) {
  if (catalog === products) return getProductByCode(code);
  return catalog.find((p) => p.code === code);
}

export function productsBySubcategory(
  slug: string,
  sub: string,
  catalog: Product[] = products,
) {
  return productsInCategory(slug, catalog).filter((p) => p.subcategory === sub);
}

export function subcategoriesFor(slug: string, catalog: Product[] = products) {
  const seen = new Map<string, number>();
  for (const p of productsInCategory(slug, catalog)) {
    seen.set(p.subcategory, (seen.get(p.subcategory) ?? 0) + 1);
  }
  return [...seen.entries()].map(([sub, count]) => ({
    slug: sub,
    name: SUBCATEGORY_LABELS[sub] ?? sub,
    count,
  }));
}

export function searchProducts(
  query: string,
  category?: string,
  catalog: Product[] = products,
) {
  return searchListing(catalog, query, category);
}

export const categoryCounts = categoryCountsFrom(products);
