import "server-only";

import { cache } from "react";
import { productAudience } from "@/lib/audience";
import { CATEGORIES } from "@/lib/catalog";
import { withStorefrontCategories } from "@/lib/classify";
import { productHubs, productInHub } from "@/lib/hub-membership";
import { listingHay, type ListingItem } from "@/lib/listing-core";
import { withProductImages } from "@/lib/media";
import type { Product } from "@/lib/types";
import bundled from "@/data/products.json";

/** Process-level memo of the offline bundled catalog (avoid re-mapping 11k rows per call). */
export const offlineCatalog: Product[] = withStorefrontCategories(
  (bundled as Product[]).map(withProductImages),
);

for (const product of offlineCatalog) {
  const item = product as ListingItem;
  item.hay = listingHay(item);
  item.audience = productAudience(product);
}

export const productsByCode = new Map(offlineCatalog.map((p) => [p.code, p]));

const productsByHub = new Map<string, Product[]>();
for (const product of offlineCatalog) {
  for (const hub of productHubs(product)) {
    const list = productsByHub.get(hub) ?? [];
    list.push(product);
    productsByHub.set(hub, list);
  }
}

export function getProductByCode(code: string): Product | undefined {
  return productsByCode.get(code);
}

export function productsInHub(slug: string): Product[] {
  return productsByHub.get(slug) ?? [];
}

export function productsByCategory(slug: string, catalog: Product[] = offlineCatalog) {
  if (catalog === offlineCatalog) return productsInHub(slug);
  return catalog.filter((p) => productInHub(p, slug));
}

export function categoryCountsFrom(catalog: Product[] = offlineCatalog) {
  if (catalog === offlineCatalog) {
    return Object.fromEntries(
      CATEGORIES.map((c) => [c.slug, productsByHub.get(c.slug)?.length ?? 0]),
    ) as Record<string, number>;
  }
  return Object.fromEntries(
    CATEGORIES.map((c) => [c.slug, catalog.filter((p) => productInHub(p, c.slug)).length]),
  ) as Record<string, number>;
}

export const getOfflineCatalog = cache(async (): Promise<Product[]> => offlineCatalog);
