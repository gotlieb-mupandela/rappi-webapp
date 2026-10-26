import type { Product } from "@/lib/types";
import { productCardImageCandidates } from "@/lib/media";
import { itemFamilyOf, type JomaFolderDef } from "@/lib/joma-tree";
import { offlineCatalog } from "@/lib/offline-catalog";
import { EMPTY_FOLDER_CODES, TILE_GALLERY_FILE, TILE_PRODUCT_CODES } from "@/lib/tile-cover-pins";

/**
 * Folder and homepage tiles that need a specific catalog product as their
 * picture. Callers pass the product to HubTile (or `productCardImageUrl`);
 * they do not paste CDN strings. These products are not added to empty
 * listings — the photo is chrome only.
 *
 * Landing tiles pin the same way with `productIds` in `lib/joma-nav.ts`.
 */
const byCode = new Map<string, Product>();
for (const product of offlineCatalog) {
  byCode.set(product.code, product);
  byCode.set(product.id, product);
}

function normFamily(value: string) {
  return value
    .replace(/\s*\[\d+\]\s*$/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

/** First real catalog photo. Skips Joma `default.jpg` placeholders. */
export function usableCatalogImageUrl(product: Product) {
  return (
    productCardImageCandidates(product).find(
      (url) =>
        url &&
        !/\/default\.jpe?g(\?|$)/i.test(url) &&
        // Site no-photo plate (products Joma has no files for).
        !/^\/brand\/rappi-logo/i.test(url),
    ) ?? ""
  );
}

function productForCode(code: string | undefined, catalog: Product[]) {
  if (!code) return null;
  const product =
    (catalog === offlineCatalog ? byCode.get(code) : undefined) ??
    catalog.find((row) => row.code === code || row.id === code) ??
    null;
  if (!product || !usableCatalogImageUrl(product)) return null;
  return product;
}

/** Pinned catalog product for a folder key or homepage slot. */
export function productForPin(key: string, catalog: Product[] = offlineCatalog) {
  return productForCode(TILE_PRODUCT_CODES[key], catalog);
}

/** Specific gallery frame for a pin. Empty when the pin uses the card image. */
export function pinnedTileImageUrl(key: string, catalog: Product[] = offlineCatalog) {
  const file = TILE_GALLERY_FILE[key];
  const product = productForPin(key, catalog);
  if (!file || !product) return "";
  return product.images.find((url) => url.endsWith(file)) ?? "";
}

/**
 * Pre-reorder frame for a pinned product used on a landing tile.
 * Kids is excluded: that tile is allowed to show the child photo.
 */
export function pinnedFrameUrlForProduct(product: {
  code: string;
  images?: string[] | null;
}) {
  for (const [key, file] of Object.entries(TILE_GALLERY_FILE)) {
    if (key === "home:kids") continue;
    if (TILE_PRODUCT_CODES[key] !== product.code) continue;
    return (product.images ?? []).find((url) => url.endsWith(file)) ?? "";
  }
  return "";
}

/** Catalog product for a folder that has no in-folder sample. Does not replace one. */
export function emptyFolderProduct(key: string, catalog: Product[] = offlineCatalog) {
  return productForCode(EMPTY_FOLDER_CODES[key], catalog);
}

/**
 * Local plates that do not depict the category they were assigned to.
 * hub-rugby.png is a suit, hub-kids.png and hub-lifestyle.png are adult
 * activewear, hub-shoes.png is running footwear (wrong on apparel folders).
 */
export function brandCoverIfSafe(
  cover: string | undefined,
  kind: "footwear" | "apparel" | "kids",
) {
  if (!cover) return "";
  const path = cover.split("?")[0] ?? cover;
  if (!path.startsWith("/brand/")) return "";
  if (/\/hub-rugby\.(png|webp)$/.test(path)) return "";
  if (/\/hub-kids\.png$/.test(path)) return "";
  if (/\/hub-lifestyle\.png$/.test(path)) return "";
  if (/\/hub-shoes\.png$/.test(path) && kind !== "footwear") return "";
  return cover;
}

const familyIndexCache = new WeakMap<Product[], Map<string, Product>>();

function familyIndex(catalog: Product[]) {
  const cached = familyIndexCache.get(catalog);
  if (cached) return cached;
  const index = new Map<string, Product>();
  for (const product of catalog) {
    const family = itemFamilyOf(product);
    if (!family || index.has(family)) continue;
    if (!usableCatalogImageUrl(product)) continue;
    index.set(family, product);
  }
  familyIndexCache.set(catalog, index);
  return index;
}

function productMatchesSport(product: Product, sport: string) {
  if (product.category === sport || product.hubs?.includes(sport)) return true;
  const blob = `${product.displayName} ${product.name} ${product.item}`.toLowerCase();
  return blob.includes(sport);
}

/**
 * Product for a folder that has no in-folder image: exact item-family match
 * elsewhere in the catalog. Does not change folder membership.
 */
export function familyChromeProduct(folder: JomaFolderDef, catalog: Product[]) {
  const needles = new Set<string>();
  for (const name of [...(folder.families ?? []), ...(folder.exactFamilies ?? [])]) {
    const norm = normFamily(name);
    if (norm.length >= 3) needles.add(norm);
  }
  if (!needles.size) return null;
  const index = familyIndex(catalog);
  const hits: Product[] = [];
  for (const needle of needles) {
    const product = index.get(needle);
    if (product) hits.push(product);
  }
  const pool = folder.sport
    ? hits.filter((product) => productMatchesSport(product, folder.sport!))
    : hits;
  return pool[0] ?? null;
}
