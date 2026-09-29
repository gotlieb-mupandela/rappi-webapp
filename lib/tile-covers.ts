import type { Product } from "@/lib/types";
import { productCardImageCandidates } from "@/lib/media";
import { itemFamilyOf, type JomaFolderDef } from "@/lib/joma-tree";
import { offlineCatalog } from "@/lib/offline-catalog";

/**
 * Catalog product codes used as tile chrome. The photo is resolved from the
 * baked catalog (Demandware medium, then Joma.net). These codes are not added
 * to empty folder listings — they only fill the picture.
 *
 * Picks are same-family where the catalog has that product. Footwear tiles
 * with no shoe in the bake (handball, basketball) use that sport's kit photo
 * rather than a blank plate or a shoe from another sport.
 */
const TILE_PRODUCT_CODES: Record<string, string> = {
  // Homepage bento — lifestyle has no plate; kids plate is an adult model.
  "home:lifestyle": "100818.200",
  "home:kids": "500747.475",

  // Man / Woman landings whose plate or hub sample was the wrong family.
  "/shop/men?group=teamwear": "104594.102",
  "/shop/men?group=cycling": "103456.112",
  "/shop/men?group=fitness-gym": "102968.008",
  "/shop/men?group=lifestyle-apparel": "100818.200",
  "/shop/men?group=aguila-line": "105681.003",
  "/shop/men?group=resort": "104657.100",
  "/shop/men?group=beachwear": "105382.585",
  "/shop/men?group=elite-club": "104798.200",
  // Crono jersey — the athletics-federation "cycling shorts" are not this folder.
  "/shop/women?group=cycling": "105427.100",
  "/shop/women?group=fitness-gym-woman": "102968.008",
  // Águila Line apparel. C.aguila LADY is a shoe filed under Previous seasons.
  "/shop/women?group=aguila-line": "105681.576",
  "/shop/women?group=resort": "104657.100",
  // Women's beachwear tile: bikini from the Beachwear family (men stay on swim shorts).
  "/shop/women?group=beachwear": "903276.740",
  // Woman landing hrefs use the audience-scoped folder key.
  "/shop/women?group=running-trail-woman": "104129.100",
  "/shop/women?group=racket-sports-woman": "103538.837",
  "/shop/women?group=lifestyle-apparel-woman": "104736.324",
  "/shop/women?group=elite-club": "104798.200",

  // Children age bands — catalog age families, not the adult kids plate.
  "/shop/kids?age=1-4": "600157.600",
  "/shop/kids?age=6-10": "500948.200",
  "/shop/kids?age=12-14&gender=boy": "500947.003",
  "/shop/kids?age=12-14&gender=girl": "500951.594",
  "kids-1-4": "600157.600",
  "kids-6-10": "500948.200",
  "kids-12-14-boy": "500947.003",
  "kids-12-14-girl": "500951.594",

  // Teamwear hero: in-folder sample is a goalkeeper base layer.
  teamwear: "104594.102",
  // R-Trail sweatshirt. Record II is a generic training tee, not this folder.
  "running-trail-woman": "104129.100",
  "fitness-gym-woman": "102968.008",
  "lifestyle-apparel-woman": "104736.324",
  // Smash is a Woman racket collection. The FITP federation polo is not.
  "racket-sports-woman": "103538.837",
  "underwear-brama-woman": "101015.200",
  beachwear: "105382.585",

  // Footwear folders with no in-hub shoe sample.
  "padel-shoes": "TSLAMS2601OM",
  "se-padel": "TSLAMS2601OM",
  pickleball: "PSTROLS2602C",
  "hockey-shoes": "HPULW2602",
  "joma-flow": "CJFZENS2723",
  "handball-shoes": "104913.102",
  "basketball-shoes": "101660.100",
  "footwear-outlet": "FSS2402IN",
  "/shop/shoes?group=footwear-outlet": "FSS2402IN",

  // Official kits — suit / lifestyle plates were not kits.
  "/teamwear?view=kits&group=kits-federations": "AH10601B0101",
  "/teamwear?view=kits&group=kits-special": "RECS2776IN",

  // Accessories: medias was a backpack; tiendas had no photo.
  "/shop/balls-bags?group=acc-medias": "400022.100",
  "acc-medias": "400022.100",
  "/shop/balls-bags?group=acc-tiendas": "JOM-019",
  "acc-tiendas": "JOM-019",
  // Outdoor backpack (trail socks are running). Teamwear gloves (a shoe bag is not teamwear).
  "/shop/hiking?group=acc-outdoor": "401970.477",
  "acc-outdoor": "401970.477",
  "/shop/sportswear?group=acc-teamwear": "400024.100",
  "acc-teamwear": "400024.100",
  "/shop/sportswear?group=acc-racket": "401845.100",
  "acc-racket": "401845.100",

  // Outlet photo tiles — clearance families, not a repeated barefoot sneaker.
  "/promotions?group=outlet-promotions": "101588.100",
  "/shop/shoes?group=outlet-footwear": "FSS2402IN",
  "/promotions?group=outlet-sweatshirt-jacket": "101589.100",
  "/promotions?group=outlet-tshirt-top": "101588.200",
  "/promotions?group=outlet-pants-shorts": "102841.100",
  "/promotions?group=outlet-anorak": "500764.100",
  // No Tracksuit SKU is filed on the Outlet tracksuit leaf (Academy IV is a
  // different collection). That tile stays a graphic card.
  "/promotions?group=outlet-junior": "500804.435",
  "/promotions?group=outlet-price-199-299": "900935.027",
  "/promotions?group=outlet-price-399-499": "101291.452",
  "/promotions?group=outlet-price-499-599": "901267.601",
  "/promotions?group=outlet-price-599-699": "102219.336",
  "/promotions?group=outlet-price-699-799": "102752.100",
  "/promotions?group=outlet-price-799-1099": "103908.991",
  "/promotions?group=outlet-price-1099-1599": "600115.426",
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

function urlForCode(code: string | undefined, catalog: Product[]) {
  if (!code) return "";
  const product =
    (catalog === offlineCatalog ? byCode.get(code) : undefined) ??
    catalog.find((row) => row.code === code || row.id === code);
  return product ? usableCatalogImageUrl(product) : "";
}

export function coverUrlForKey(key: string, catalog: Product[] = offlineCatalog) {
  return urlForCode(TILE_PRODUCT_CODES[key], catalog);
}

/** Catalog photo for a folder that has no in-folder sample. Does not replace one. */
export function emptyFolderCoverUrl(key: string, catalog: Product[] = offlineCatalog) {
  return urlForCode(EMPTY_FOLDER_CODES[key], catalog);
}

/** Prefer a pinned catalog photo over whatever the tile resolved on its own. */
export function applyTileCover(key: string, fallback: string, catalog: Product[]) {
  return coverUrlForKey(key, catalog) || fallback;
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
  if (/\/hub-rugby\.png$/.test(path)) return "";
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
 * Photo for a folder that has no in-folder image: exact item-family match
 * elsewhere in the catalog. Does not change folder membership.
 */
export function familyChromeUrl(folder: JomaFolderDef, catalog: Product[]) {
  const needles = new Set<string>();
  for (const name of [...(folder.families ?? []), ...(folder.exactFamilies ?? [])]) {
    const norm = normFamily(name);
    if (norm.length >= 3) needles.add(norm);
  }
  if (!needles.size) return "";
  const index = familyIndex(catalog);
  const hits: Product[] = [];
  for (const needle of needles) {
    const product = index.get(needle);
    if (product) hits.push(product);
  }
  const pool = folder.sport
    ? hits.filter((product) => productMatchesSport(product, folder.sport!))
    : hits;
  const pick = pool[0];
  return pick ? usableCatalogImageUrl(pick) : "";
}
