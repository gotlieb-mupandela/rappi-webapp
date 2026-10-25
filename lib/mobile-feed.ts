import { matchesAudience } from "@/lib/audience";
import { clientAssortment } from "@/lib/assortment";
import { SUBCATEGORY_LABELS, TYPE_FOLDER_ORDER, typeFolderForSubcategory } from "@/lib/catalog";
import { DPO_TEST_CODE } from "@/lib/dpo-test-product";
import { formatPrice } from "@/lib/format";
import { productHubs, productInHub } from "@/lib/hub-membership";
import { allowedImageHosts, imageHostAllows } from "@/lib/image-hosts";
import { isJomaBrowseFolder } from "@/lib/joma-folder-meta";
import { jomaFolderTileImage } from "@/lib/joma-tile-images";
import { jomaFolderMetaSnapshot } from "@/lib/joma-tree";
import { filterListing, type ListingItem } from "@/lib/listing-core";
import { cardImageUrl, hasUsableProductImage, isAllowedProductImageUrl, listingCardCandidates } from "@/lib/media";
import { metaAbsoluteUrl } from "@/lib/meta/site";
import {
  FEED_MENUS,
  FLOW_TILE,
  HOME_TILES,
  KIDS_TILES,
  PROMO_TILES,
  feedAudienceTargets,
  feedCategoryTargets,
  feedSubcategoryTarget,
  feedTargetTable,
  feedTypeFolderTarget,
  type FeedMenuDef,
  type FeedTargetTile,
} from "@/lib/mobile-feed-targets";
import { mobileFeedVersion } from "@/lib/mobile-feed-version";
import { publicCopy, publicFolderKey } from "@/lib/mobile-feed-slugs";
import { buildTaxonomy, categoryCountsFromTaxonomy } from "@/lib/taxonomy";
import type { Product } from "@/lib/types";

export type FeedTile = {
  id: string;
  label: string;
  order: number;
  targetId: string;
  href: string;
  image: string | null;
  count: number;
};

export type FeedFolder = {
  key: string;
  label: string;
  order: number;
  parent: string | null;
  image: string | null;
  targetId: string;
  href: string;
  count: number;
  hasChildren: boolean;
};

export type FeedCategoryChild = {
  slug: string;
  label: string;
  order: number;
  parent: string;
  image: string | null;
  targetId: string;
  href: string;
  count: number;
  kind: "group" | "sub";
};

export type FeedCategory = {
  slug: string;
  label: string;
  order: number;
  parent: null;
  image: string | null;
  targetId: string;
  href: string;
  count: number;
  children: FeedCategoryChild[];
};

export type FeedTarget = {
  id: string;
  href: string;
};

export type FeedProduct = {
  code: string;
  name: string;
  label: string | null;
  packLabel: string | null;
  pairCount: number | null;
  isPack: boolean;
  price: number;
  priceLabel: string;
  cardImage: string | null;
  line?: string | null;
};

export type MobileFeed = {
  version: string;
  targets: FeedTarget[];
  home: { sections: Array<{ id: string; label: string; tiles: FeedTile[] }> };
  audiences: FeedTile[];
  menus: Array<{
    id: string;
    slug: string;
    label: string;
    order: number;
    targetId: string;
    href: string;
    image: string | null;
    tiles: FeedTile[];
  }>;
  folders: FeedFolder[];
  kids: { tiles: FeedTile[] };
  flow: FeedTile | null;
  promos: FeedTile[];
  categories: FeedCategory[];
  categoryOrder: string[];
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

/** Names and labels are plain text. Markup and control characters are removed. */
function plainText(value: string): string {
  return publicCopy(value)
    .replace(/[<>\u0000-\u001f\u007f]/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function labelOrNull(value: string): string | null {
  const next = plainText(value);
  return next || null;
}

function linked(targetId: string, table: ReadonlyMap<string, string>) {
  const href = table.get(targetId);
  if (!href) return null;
  return { targetId, href };
}

const CATEGORY_IMAGE: Record<string, string> = {
  sportswear: "/brand/hub-sportswear.png",
  shoes: "/brand/hub-shoes.png",
  "running-fitness": "/brand/hub-shoes.png",
  "balls-bags": "/brand/hub-sportswear.png",
  "teampro-2026": "/brand/hub-teampro-2026.webp",
};

const AUDIENCE_IMAGE: Record<string, string> = {
  men: "/brand/audience-men.png?v=3",
  women: "/brand/audience-women.png?v=4",
  kids: "/brand/hub-sportswear.png",
};

export function feedProductCard(product: Product): FeedProduct | null {
  if (product.code === DPO_TEST_CODE || product.available === false) return null;
  if (!hasUsableProductImage(product)) return null;
  const view = clientAssortment(product);
  const base = product.displayName || product.name || product.item || product.code;
  const suffix = view.titleSuffix ?? "";
  const suffixText = suffix.replace(/^ · /, "");
  const combined = suffixText && !base.includes(suffixText) ? `${base}${suffix}` : base;
  const name = plainText(combined) || product.code;
  const label = view.label ? plainText(view.label) : null;
  const line = productLine(product);
  return {
    code: product.code,
    name,
    label,
    packLabel: label,
    pairCount: view.pairCount,
    isPack: view.isPack,
    price: product.price,
    priceLabel: formatPrice(product.price),
    cardImage: feedImageUrl(listingCardCandidates(product)[0] ?? null),
    ...(line !== undefined ? { line } : {}),
  };
}

/**
 * `line` is included only when the catalogue row already has that field.
 * The current base does not. A later label commit can add it without a second copy here.
 */
function productLine(product: Product): string | null | undefined {
  if (!Object.prototype.hasOwnProperty.call(product, "line")) return undefined;
  const value = (product as Product & { line?: unknown }).line;
  if (typeof value !== "string") return null;
  return plainText(value) || null;
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

function toTile(
  tile: FeedTargetTile,
  counts: Map<string, number>,
  table: ReadonlyMap<string, string>,
  order: number,
): FeedTile | null {
  const link = linked(tile.id, table);
  if (!link || link.href !== tile.href) return null;
  const label = labelOrNull(tile.label);
  if (!label) return null;
  if (tile.folderKey && EMPTY_WHEN_HIDDEN.has(tile.folderKey) && countFor(counts, tile.folderKey) === 0) {
    return null;
  }
  return {
    id: tile.id,
    label,
    order,
    targetId: link.targetId,
    href: link.href,
    image: tileImage(tile.image),
    count: countFor(counts, tile.folderKey),
  };
}

function menuTiles(menu: FeedMenuDef, counts: Map<string, number>, table: ReadonlyMap<string, string>): FeedTile[] {
  const source = menu.id === "shoes" ? [...menu.tiles, FLOW_TILE] : [...menu.tiles];
  const tiles: FeedTile[] = [];
  for (const tile of source) {
    if (menu.id === "outlet" && countFor(counts, tile.folderKey) === 0) continue;
    const next = toTile(tile, counts, table, tiles.length);
    if (next) tiles.push(next);
  }
  return tiles;
}

function hubIndexes(products: readonly Product[]) {
  const subs = new Map<string, number>();
  const groups = new Map<string, number>();
  for (const product of products) {
    const group = typeFolderForSubcategory(product.subcategory);
    for (const hub of productHubs(product)) {
      const subKey = `${hub}\0${product.subcategory}`;
      subs.set(subKey, (subs.get(subKey) ?? 0) + 1);
      const groupKey = `${hub}\0${group}`;
      groups.set(groupKey, (groups.get(groupKey) ?? 0) + 1);
    }
  }
  return { subs, groups };
}

function categoryTree(
  navVisible: readonly Product[],
  categoryCounts: Record<string, number>,
  table: ReadonlyMap<string, string>,
): FeedCategory[] {
  const index = hubIndexes(navVisible);
  const categories: FeedCategory[] = [];
  for (const category of feedCategoryTargets()) {
    const link = linked(category.targetId, table);
    if (!link || link.href !== category.href) continue;
    const label = labelOrNull(category.label) ?? category.slug;
    const children: FeedCategoryChild[] = [];
    for (const group of TYPE_FOLDER_ORDER) {
      const target = feedTypeFolderTarget(category.slug, group);
      if (!target) continue;
      const childLink = linked(target.targetId, table);
      if (!childLink || childLink.href !== target.href) continue;
      const count = index.groups.get(`${category.slug}\0${group}`) ?? 0;
      if (count <= 0) continue;
      const childLabel = labelOrNull(SUBCATEGORY_LABELS[group] ?? target.label);
      if (!childLabel) continue;
      children.push({
        slug: group,
        label: childLabel,
        order: children.length,
        parent: link.targetId,
        image: null,
        targetId: childLink.targetId,
        href: childLink.href,
        count,
        kind: "group",
      });
    }
    for (const sub of Object.keys(SUBCATEGORY_LABELS)) {
      const target = feedSubcategoryTarget(category.slug, sub);
      if (!target) continue;
      const childLink = linked(target.targetId, table);
      if (!childLink || childLink.href !== target.href) continue;
      const count = index.subs.get(`${category.slug}\0${sub}`) ?? 0;
      if (count <= 0) continue;
      const childLabel = labelOrNull(target.label);
      if (!childLabel) continue;
      children.push({
        slug: sub,
        label: childLabel,
        order: children.length,
        parent: link.targetId,
        image: null,
        targetId: childLink.targetId,
        href: childLink.href,
        count,
        kind: "sub",
      });
    }
    categories.push({
      slug: category.slug,
      label,
      order: category.order,
      parent: null,
      image: feedImageUrl(CATEGORY_IMAGE[category.slug] ?? null),
      targetId: link.targetId,
      href: link.href,
      count: categoryCounts[category.slug] ?? navVisible.filter((product) => productInHub(product, category.slug)).length,
      children,
    });
  }
  return categories;
}

export function buildMobileFeed(catalog: FeedSource[], version: string): MobileFeed {
  const table = feedTargetTable();
  const counts = folderProductCounts(catalog);
  const navVisible = catalog.filter(
    (product) => product.available !== false && product.code !== DPO_TEST_CODE,
  );
  const visible = filterListing(catalog as ListingItem[], {});
  const products = visible
    .map((product) => feedProductCard(product))
    .filter((product): product is FeedProduct => Boolean(product))
    .sort((a, b) => a.code.localeCompare(b.code));

  const siblingIndex = new Map<string, number>();
  const siblingSeen = new Map<string, number>();
  for (const row of jomaFolderMetaSnapshot()) {
    const parent = row.parent ?? "";
    const next = siblingSeen.get(parent) ?? 0;
    siblingIndex.set(row.key, next);
    siblingSeen.set(parent, next + 1);
  }

  const folders: FeedFolder[] = [];
  for (const row of jomaFolderMetaSnapshot()) {
    const key = publicFolderKey(row.key);
    const targetId = `folder:${key}`;
    const link = linked(targetId, table);
    if (!link) continue;
    const label = labelOrNull(row.label) || key;
    folders.push({
      key,
      label,
      order: siblingIndex.get(row.key) ?? 0,
      parent: row.parent ? publicFolderKey(row.parent) : null,
      image: feedImageUrl(jomaFolderTileImage(row.key) || null),
      targetId: link.targetId,
      href: link.href,
      count: counts.get(row.key) ?? 0,
      hasChildren: false,
    });
  }
  folders.sort((a, b) => a.order - b.order || a.key.localeCompare(b.key));
  const parents = new Set(folders.map((folder) => folder.parent).filter((key): key is string => Boolean(key)));
  for (const folder of folders) folder.hasChildren = parents.has(folder.key);

  const homeTiles = HOME_TILES.map((tile, index) => toTile(tile, counts, table, index)).filter(
    (tile): tile is FeedTile => Boolean(tile),
  );
  const kidsTiles = KIDS_TILES.map((tile, index) => toTile(tile, counts, table, index)).filter(
    (tile): tile is FeedTile => Boolean(tile),
  );
  const promos = PROMO_TILES.map((tile, index) => toTile(tile, counts, table, index))
    .filter((tile): tile is FeedTile => Boolean(tile))
    .filter((tile) => tile.count > 0);
  const flowLink = linked(FLOW_TILE.id, table);
  const flow: FeedTile | null =
    flowLink && flowLink.href === FLOW_TILE.href
      ? {
          id: FLOW_TILE.id,
          label: labelOrNull(FLOW_TILE.label) ?? "Flow",
          order: 0,
          targetId: flowLink.targetId,
          href: flowLink.href,
          image: tileImage(FLOW_TILE.image),
          count: countFor(counts, FLOW_TILE.folderKey),
        }
      : null;
  const audiences = feedAudienceTargets().flatMap((row) => {
    const link = linked(row.id, table);
    if (!link || link.href !== row.href) return [];
    const label = labelOrNull(row.label);
    if (!label) return [];
    return [
      {
        id: row.id,
        label,
        order: row.order,
        targetId: link.targetId,
        href: link.href,
        image: feedImageUrl(AUDIENCE_IMAGE[row.slug] ?? null),
        count: navVisible.filter((product) => matchesAudience(product, row.slug)).length,
      },
    ];
  });
  const categoryCounts = categoryCountsFromTaxonomy(buildTaxonomy(navVisible));
  const categories = categoryTree(navVisible, categoryCounts, table);
  const menus = FEED_MENUS.flatMap((menu, order) => {
    const link = linked(`menu:${menu.id}`, table);
    if (!link || link.href !== menu.href) return [];
    const label = labelOrNull(menu.label) ?? menu.id;
    return [
      {
        id: menu.id,
        slug: menu.slug,
        label,
        order,
        targetId: link.targetId,
        href: link.href,
        image: tileImage(menu.image),
        tiles: menuTiles(menu, counts, table),
      },
    ];
  });

  const used = new Set<string>();
  const take = (id: string) => used.add(id);
  for (const tile of [...homeTiles, ...audiences, ...kidsTiles, ...promos]) take(tile.targetId);
  if (flow) take(flow.targetId);
  for (const menu of menus) {
    take(menu.targetId);
    for (const tile of menu.tiles) take(tile.targetId);
  }
  for (const folder of folders) take(folder.targetId);
  for (const category of categories) {
    take(category.targetId);
    for (const child of category.children) take(child.targetId);
  }
  const targets = [...used]
    .sort()
    .flatMap((id) => {
      const href = table.get(id);
      return href ? [{ id, href }] : [];
    });

  return {
    version: mobileFeedVersion(version),
    targets,
    home: { sections: [{ id: "hero", label: "Shop", tiles: homeTiles }] },
    audiences,
    menus,
    folders,
    kids: { tiles: kidsTiles },
    flow,
    promos,
    categories,
    categoryOrder: categories.map((category) => category.slug),
    counts: {
      categories: categoryCounts,
      products: products.length,
    },
    products,
  };
}
