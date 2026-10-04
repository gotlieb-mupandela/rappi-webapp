import "server-only";

import { cache } from "react";
import { productAudience } from "@/lib/audience";
import { CATEGORIES } from "@/lib/catalog";
import { productHubs, productInHub } from "@/lib/hub-membership";
import { indexCatalogFromBakedFolders, matchJomaFolderKeys } from "@/lib/joma-tree";
import { listingHay, type ListingItem } from "@/lib/listing-core";
import { hasUsableProductImage, withProductImages } from "@/lib/media";
import type { Product } from "@/lib/types";
import productFolders from "@/data/product-folders.json";
import bundled from "@/data/products.json";
import { dpoTestProduct, isDpoTestCheckoutEnabled } from "@/lib/dpo-test-product";

const FOLDERS_BY_ID = productFolders as Record<string, string[]>;

/** Process-level memo of the offline bundled catalog (avoid re-mapping 11k rows per call). */
export const offlineCatalog: Product[] = [
  ...(bundled as ListingItem[]).map((product) => ({
    ...product,
    folders: product.folders ?? FOLDERS_BY_ID[product.id] ?? matchJomaFolderKeys(product),
  })),
  ...(isDpoTestCheckoutEnabled()
    ? [{ ...withProductImages(dpoTestProduct), folders: [] } as ListingItem]
    : []),
];

indexCatalogFromBakedFolders(offlineCatalog as ListingItem[]);

for (const product of offlineCatalog) {
  const item = product as ListingItem;
  if (!item.hay) item.hay = listingHay(item);
  if (!item.audience) item.audience = productAudience(product);
  if (typeof item.hasImage !== "boolean") item.hasImage = hasUsableProductImage(product);
}

/** Catalog rows with a usable storefront image (skip silhouette-only SKUs on browse). */
export const offlineCatalogImaged: Product[] = offlineCatalog.filter(
  (p) => (p as ListingItem).hasImage,
);

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
  return (productsByHub.get(slug) ?? []).filter((p) => p.available !== false);
}

export function productsByCategory(slug: string, catalog: Product[] = offlineCatalog) {
  if (catalog === offlineCatalog) return productsInHub(slug);
  return catalog.filter((p) => p.available !== false && productInHub(p, slug));
}

export function categoryCountsFrom(catalog: Product[] = offlineCatalog) {
  if (catalog === offlineCatalog) {
    return Object.fromEntries(
      CATEGORIES.map((c) => [c.slug, productsInHub(c.slug).length]),
    ) as Record<string, number>;
  }
  const visible = catalog.filter((p) => p.available !== false);
  return Object.fromEntries(
    CATEGORIES.map((c) => [c.slug, visible.filter((p) => productInHub(p, c.slug)).length]),
  ) as Record<string, number>;
}

export const getOfflineCatalog = cache(async (): Promise<Product[]> => offlineCatalog);
