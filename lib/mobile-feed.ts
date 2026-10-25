import { clientAssortment } from "@/lib/assortment";
import { DPO_TEST_CODE } from "@/lib/dpo-test-product";
import { formatPrice } from "@/lib/format";
import { isJomaBrowseFolder } from "@/lib/joma-folder-meta";
import { jomaFolderMetaSnapshot } from "@/lib/joma-tree";
import { allowedImageHosts, imageHostAllows } from "@/lib/image-hosts";
import { filterListing, type ListingItem } from "@/lib/listing-core";
import { cardImageUrl, hasUsableProductImage, isAllowedProductImageUrl } from "@/lib/media";
import { metaAbsoluteUrl } from "@/lib/meta/site";
import {
  FEED_MENUS,
  FLOW_TILE,
  HOME_TILES,
  KIDS_TILES,
  PROMO_TILES,
  feedTargetSet,
  folderHref,
  type FeedMenuDef,
  type FeedTargetTile,
} from "@/lib/mobile-feed-targets";
import { publicCopy, publicFolderKey } from "@/lib/mobile-feed-slugs";
import { buildTaxonomy, categoryCountsFromTaxonomy } from "@/lib/taxonomy";
import type { Product } from "@/lib/types";

export type FeedTile = {
  id: string;
  label: string;
  href: string;
  image: string | null;
  count: number;
};

export type FeedFolder = {
  key: string;
  label: string;
  parent: string | null;
  href: string;
  count: number;
  hasChildren: boolean;
};

export type FeedProduct = {
  code: string;
  name: string;
  packLabel: string | null;
  pairCount: number | null;
  isPack: boolean;
  price: number;
  priceLabel: string;
  cardImage: string | null;
};

export type MobileFeed = {
  version: string;
  home: { sections: Array<{ id: string; label: string; tiles: FeedTile[] }> };
  menus: Array<{
    id: string;
    slug: string;
    label: string;
    href: string;
    image: string | null;
    tiles: FeedTile[];
  }>;
  folders: FeedFolder[];
  kids: { tiles: FeedTile[] };
  promos: FeedTile[];
  counts: { categories: Record<string, number>; products: number };
  products: FeedProduct[];
};

export type FeedSource = Product & { folders?: string[] };

const EMPTY_WHEN_HIDDEN = new Set(["joma-flow", "wf-joma-flow"]);

/**
 * Absolute https image, or null when the URL is dropped.
 * Relative paths are resolved with metaAbsoluteUrl first.
 * A host is kept only when allowedImageHosts() plus imageHostAllows() match.
 * The canonical site origin is not a row in that list. It is kept only when
 * isAllowedProductImageUrl allows it, which is the same same-origin check the
 * catalogue card field uses. No host strings are copied here.
 */
export function feedImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed || trimmed.startsWith("//") || /^http:\/\//i.test(trimmed)) return null;
  const absolute = /^https:\/\//i.test(trimmed)
    ? trimmed
    : trimmed.startsWith("/")
      ? metaAbsoluteUrl(trimmed)
      : null;
  if (!absolute || !/^https:\/\//i.test(absolute)) return null;
  let parsed: URL;
  try {
    parsed = new URL(absolute);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:") return null;
  const listed = allowedImageHosts().some((rule) =>
    imageHostAllows(parsed.hostname, parsed.pathname, rule),
  );
  if (listed) return absolute;
  if (isAllowedProductImageUrl(absolute)) return absolute;
  return null;
}

function tileImage(path: string): string | null {
  return feedImageUrl(cardImageUrl({ imageUrl: path, images: [] }) ?? path);
}

function labelOrNull(value: string): string | null {
  const next = publicCopy(value);
  return next || null;
}

export function feedProductCard(product: Product): FeedProduct | null {
  if (product.code === DPO_TEST_CODE || product.available === false) return null;
  if (!hasUsableProductImage(product)) return null;
  const view = clientAssortment(product);
  const base = product.displayName || product.name || product.item || product.code;
  const suffix = view.titleSuffix ?? "";
  const suffixText = suffix.replace(/^ · /, "");
  const combined = suffixText && !base.includes(suffixText) ? `${base}${suffix}` : base;
  const name = publicCopy(combined) || product.code;
  return {
    code: product.code,
    name,
    packLabel: view.label ? labelOrNull(view.label) : null,
    pairCount: view.pairCount,
    isPack: view.isPack,
    price: product.price,
    priceLabel: formatPrice(product.price),
    cardImage: feedImageUrl(cardImageUrl(product)),
  };
}

/**
 * Same visible set as an unscoped shop listing, then one membership count per
 * browse folder. Matches filterListing(catalog, { group }) length for keys
 * isJomaBrowseFolder accepts.
 */
export function folderProductCounts(catalog: FeedSource[]): Map<string, number> {
  const visible = filterListing(catalog as ListingItem[], {});
  const counts = new Map<string, number>();
  for (const product of visible) {
    const keys = new Set(product.folders ?? []);
    for (const key of keys) {
      if (!isJomaBrowseFolder(key)) continue;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return counts;
}

function countFor(counts: Map<string, number>, folderKey: string | undefined): number {
  if (!folderKey) return 0;
  return counts.get(folderKey) ?? 0;
}

function toTile(tile: FeedTargetTile, counts: Map<string, number>, allowed: ReadonlySet<string>): FeedTile | null {
  if (!allowed.has(tile.href)) return null;
  const label = labelOrNull(tile.label);
  if (!label) return null;
  if (tile.folderKey && EMPTY_WHEN_HIDDEN.has(tile.folderKey) && countFor(counts, tile.folderKey) === 0) {
    return null;
  }
  return {
    id: tile.id,
    label,
    href: tile.href,
    image: tileImage(tile.image),
    count: countFor(counts, tile.folderKey),
  };
}

function menuTiles(menu: FeedMenuDef, counts: Map<string, number>, allowed: ReadonlySet<string>): FeedTile[] {
  const source = menu.id === "shoes" ? [...menu.tiles, FLOW_TILE] : [...menu.tiles];
  const tiles: FeedTile[] = [];
  for (const tile of source) {
    if (menu.id === "outlet" && countFor(counts, tile.folderKey) === 0) continue;
    const next = toTile(tile, counts, allowed);
    if (next) tiles.push(next);
  }
  return tiles;
}

export function buildMobileFeed(catalog: FeedSource[], version: string): MobileFeed {
  const allowed = feedTargetSet();
  const counts = folderProductCounts(catalog);
  const navVisible = catalog.filter(
    (product) => product.available !== false && product.code !== DPO_TEST_CODE,
  );
  const visible = filterListing(catalog as ListingItem[], {});
  const products = visible
    .map((product) => feedProductCard(product))
    .filter((product): product is FeedProduct => Boolean(product))
    .sort((a, b) => a.code.localeCompare(b.code));

  const folders: FeedFolder[] = [];
  for (const row of jomaFolderMetaSnapshot()) {
    const count = counts.get(row.key) ?? 0;
    if (count <= 0) continue;
    const href = folderHref(row.key);
    if (!href || !allowed.has(href)) continue;
    const label = labelOrNull(row.label);
    if (!label) continue;
    const key = publicFolderKey(row.key);
    folders.push({
      key,
      label,
      parent: row.parent ? publicFolderKey(row.parent) : null,
      href,
      count,
      hasChildren: false,
    });
  }
  folders.sort((a, b) => a.key.localeCompare(b.key));
  const parents = new Set(folders.map((folder) => folder.parent).filter((key): key is string => Boolean(key)));
  for (const folder of folders) folder.hasChildren = parents.has(folder.key);

  const homeTiles = HOME_TILES.map((tile) => toTile(tile, counts, allowed)).filter(
    (tile): tile is FeedTile => Boolean(tile),
  );
  const kidsTiles = KIDS_TILES.map((tile) => toTile(tile, counts, allowed)).filter(
    (tile): tile is FeedTile => Boolean(tile),
  );
  const promos = PROMO_TILES.map((tile) => toTile(tile, counts, allowed))
    .filter((tile): tile is FeedTile => Boolean(tile))
    .filter((tile) => tile.count > 0);

  return {
    version,
    home: { sections: [{ id: "hero", label: "Shop", tiles: homeTiles }] },
    menus: FEED_MENUS.map((menu) => {
      const label = labelOrNull(menu.label) ?? menu.id;
      const href = allowed.has(menu.href) ? menu.href : "";
      return {
        id: menu.id,
        slug: menu.slug,
        label,
        href,
        image: tileImage(menu.image),
        tiles: href ? menuTiles(menu, counts, allowed) : [],
      };
    }).filter((menu) => menu.href),
    folders,
    kids: { tiles: kidsTiles },
    promos,
    counts: {
      categories: categoryCountsFromTaxonomy(buildTaxonomy(navVisible)),
      products: products.length,
    },
    products,
  };
}
