import type { Product } from "@/lib/types";
import { productCardImageCandidates } from "@/lib/media";
import { itemFamilyOf, type JomaFolderDef } from "@/lib/joma-tree";
import { offlineCatalog } from "@/lib/offline-catalog";

/**
 * Folder and homepage tiles that need a specific catalog product as their
 * picture. Callers pass the product to HubTile (or `productCardImageUrl`);
 * they do not paste CDN strings. These products are not added to empty
 * listings — the photo is chrome only.
 *
 * Landing tiles pin the same way with `productIds` in `lib/joma-nav.ts`.
 */
const TILE_PRODUCT_CODES: Record<string, string> = {
  // Homepage bento. Lifestyle has no brand plate; the kids plate is an adult.
  "home:lifestyle": "100818.200",
  "home:kids": "500747.475",
  // hub-shoes.png is already the Footwear tile beside it.
  "home:running": "104129.100",

  // Folder grids. Landing tiles that need the same photo use productIds.
  teamwear: "104594.102",
  "running-trail-woman": "104129.100",
  "fitness-gym-woman": "102968.008",
  "lifestyle-apparel-woman": "104736.324",
  "racket-sports-woman": "103538.837",
  "underwear-brama-woman": "101015.200",
  beachwear: "105382.585",

  "kids-1-4": "600157.600",
  "kids-6-10": "500948.200",
  "kids-12-14-boy": "500947.003",
  "kids-12-14-girl": "500951.594",

  "padel-shoes": "TSLAMS2601OM",
  "se-padel": "TSLAMS2601OM",
  pickleball: "PSTROLS2602C",
  "hockey-shoes": "HPULW2602",
  "joma-flow": "CJFZENS2723",
  // No handball or basketball shoe in the bake — that sport's kit, not another sport's shoe.
  "handball-shoes": "104913.102",
  "basketball-shoes": "101660.100",
  "footwear-outlet": "FSS2402IN",

  "acc-medias": "400022.100",
  "acc-tiendas": "JOM-019",
  "acc-outdoor": "401970.477",
  "acc-teamwear": "400024.100",
  "acc-racket": "401845.100",
};

/** Used only when the folder itself has no photographed product. */
const EMPTY_FOLDER_CODES: Record<string, string> = {
  "hiking-outdoor": "104477.004",
  "athletes-combat": "104413.200",
};

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
      (url) => url && !/\/default\.jpe?g(\?|$)/i.test(url),
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
