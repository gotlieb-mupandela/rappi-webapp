import { matchesAudience, productAudience } from "@/lib/audience";
import { clientAssortment, renderAssortmentLabel } from "@/lib/assortment";
import { DPO_TEST_CODE } from "@/lib/dpo-test-product";
import { formatPrice } from "@/lib/format";
import { allowedImageHosts, imageHostAllows } from "@/lib/image-hosts";
import { eurPerNad } from "@/lib/i18n/config";
import {
  audienceBlurb,
  audienceName,
  groupName,
  hubBlurb,
  hubName,
  shippingName,
  subName,
} from "@/lib/i18n/labels";
import { makeT, type TFunction } from "@/lib/i18n/translate";
import { isLiveFolder } from "@/lib/joma-live";
import { isJomaBrowseFolder } from "@/lib/joma-folder-meta";
import { jomaFolderTileImage } from "@/lib/joma-tile-images";
import { isOutletFolderKey, jomaFolderMetaSnapshot } from "@/lib/joma-tree";
import { filterListing, type ListingItem } from "@/lib/listing-core";
import {
  hasUsableProductImage,
  isAllowedProductImageUrl,
  listingCardCandidates,
} from "@/lib/media";
import { metaAbsoluteUrl } from "@/lib/meta/site";
import { checkoutCountries, type FeedCheckoutCountry } from "@/lib/mobile-feed-countries";
import {
  FEED_MENUS,
  FLOW_TILE,
  HOME_TILES,
  KIDS_FOOTWEAR_TILE,
  TEAM_TILES,
  feedAudienceTargets,
  feedCategoryTargets,
  feedMenuKey,
  feedTargetTable,
  footwearTypeKeys,
  headerMenuKeys,
  sportswearTypeKeys,
  type FeedMenuDef,
  type FeedTargetTile,
} from "@/lib/mobile-feed-targets";
import { mobileFeedVersion } from "@/lib/mobile-feed-version";
import { publicCopy, publicFolderKey } from "@/lib/mobile-feed-slugs";
import { shippingMethodsSnapshot } from "@/lib/shipping";
import { buildTaxonomy, categoryCountsFromTaxonomy } from "@/lib/taxonomy";
import type { Product } from "@/lib/types";

const tEn = makeT("na");
const tFr = makeT("eu");

export type FeedNode = {
  key: string;
  kind: "menu" | "folder" | "category" | "audience" | "tile";
  label: string;
  labelFr: string;
  description: string | null;
  descriptionFr: string | null;
  order: number;
  parent: string | null;
  image: string | null;
  hidden: boolean;
  count: number;
  /** Site base group (`folder.sub`, type folder, or subcategory) when one exists. */
  group: string | null;
  /** Ordered child keys for a menu, category shop-by-type list, or folder. */
  tiles: string[];
  /**
   * Site path from feedTargetTable(). Never a request value or a product field.
   */
  href: string;
};

export type FeedProduct = {
  code: string;
  name: string;
  label: string | null;
  labelFr: string | null;
  packLabel: string | null;
  pairCount: number | null;
  isPack: boolean;
  price: number;
  priceLabel: string;
  cardImage: string | null;
  images: string[];
  category: string | null;
  subcategory: string | null;
  audience: string | null;
};

export type FeedCheckout = {
  /** Euro per 1 N$. Read from eurPerNad(). Display only. */
  eurPerNad: number;
  shipping: Array<{
    key: string;
    title: { en: string; fr: string };
    amountNad: number;
  }>;
  countries: FeedCheckoutCountry[];
};

export type MobileStorefront = {
  version: string;
  nodes: FeedNode[];
  /** Header menu keys in site order. Accessories and outlet are folder keys. */
  menus: string[];
  categoryOrder: string[];
  products: FeedProduct[];
  checkout: FeedCheckout;
  counts: { categories: Record<string, number>; products: number };
};

type FeedNodeDraft = Omit<FeedNode, "href">;

export type FeedSource = Product & { folders?: string[] };

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

function tileImage(path: string | null | undefined): string | null {
  if (!path) return null;
  return feedImageUrl(path);
}

/** Names and labels are plain text. Markup and control characters are removed. */
function plainText(value: string): string {
  return publicCopy(value)
    .replace(/[<>\u0000-\u001f\u007f]/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function slugText(value: string | null | undefined): string | null {
  if (!value) return null;
  const next = plainText(value);
  if (!next || !/^[A-Za-z0-9-]+$/.test(next)) return null;
  return next;
}

function copyPair(english: string, french: string): { label: string; labelFr: string } {
  const label = plainText(english);
  const labelFr = plainText(french) || label;
  return { label, labelFr: labelFr || label };
}

function messagePair(key: string, fallback: string) {
  const english = tEn(key);
  const french = tFr(key);
  return copyPair(english === key ? fallback : english, french === key ? fallback : french);
}

const GROUP_KINDS = ["apparel", "footwear", "kids", "rugby", "brama"] as const;

function groupLabel(key: string, t: TFunction): string | null {
  for (const kind of GROUP_KINDS) {
    const named = groupName(kind, key, t);
    if (named !== key) return named;
  }
  const bare = key.replace(/^(wf-|w-)/, "");
  if (bare !== key) {
    for (const kind of GROUP_KINDS) {
      const named = groupName(kind, bare, t);
      if (named !== bare) return named;
    }
  }
  const sub = subName(key, t);
  if (sub !== key && !sub.startsWith("sub.") && !sub.startsWith("group.")) return sub;
  return null;
}

function namesFor(key: string, english: string, labelKey?: string) {
  if (labelKey) return messagePair(labelKey, english);
  const en = groupLabel(key, tEn) ?? english;
  const fr = groupLabel(key, tFr) ?? groupLabel(key, tEn) ?? english;
  return copyPair(en, fr);
}

function blurbs(kind: "hub" | "audience", slug: string) {
  const read = kind === "hub" ? hubBlurb : audienceBlurb;
  const description = plainText(read(slug, tEn)) || null;
  const descriptionFr = plainText(read(slug, tFr)) || description;
  return { description, descriptionFr };
}

const CATEGORY_IMAGE: Record<string, string> = {
  sportswear: "/brand/hub-sportswear.png",
  shoes: "/brand/hub-shoes.png",
  "running-fitness": "/brand/hub-shoes.png",
  lifestyle: "/brand/hub-sportswear.png",
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
  const french = view.labelKey
    ? renderAssortmentLabel(view.labelKey, view.labelParams, tFr, view.label)
    : view.label;
  const labelFr = french ? plainText(french) : null;
  const images = productImages(product);
  return {
    code: product.code,
    name,
    label,
    labelFr: label ? labelFr || label : null,
    packLabel: label,
    pairCount: view.pairCount,
    isPack: view.isPack,
    price: product.price,
    priceLabel: formatPrice(product.price),
    cardImage: images[0] ?? null,
    images,
    category: slugText(product.category),
    subcategory: slugText(product.subcategory),
    audience: productAudience(product),
  };
}

function productImages(product: Product): string[] {
  const seen = new Set<string>();
  const images: string[] = [];
  for (const candidate of listingCardCandidates(product)) {
    const absolute = feedImageUrl(candidate);
    if (!absolute || seen.has(absolute)) continue;
    seen.add(absolute);
    images.push(absolute);
  }
  return images;
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

function emptyNode(partial: Omit<FeedNodeDraft, "tiles" | "description" | "descriptionFr" | "group"> & {
  tiles?: string[];
  description?: string | null;
  descriptionFr?: string | null;
  group?: string | null;
}): FeedNodeDraft {
  return {
    description: null,
    descriptionFr: null,
    group: null,
    tiles: [],
    ...partial,
  };
}

/**
 * Display only. The server stays the only source of real prices, shipping, and VAT at order time.
 * No checkout or payment route reads this block.
 */
function feedCheckout(): FeedCheckout {
  const rate = eurPerNad();
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new Error("eurPerNad must be a finite number greater than 0");
  }
  return {
    eurPerNad: rate,
    shipping: shippingMethodsSnapshot().map((method) => ({
      key: method.id,
      title: {
        en: plainText(method.name),
        fr: plainText(shippingName(method.id, method.name, tFr)),
      },
      amountNad: method.cost,
    })),
    countries: checkoutCountries(),
  };
}

function homeKeys(): string[] {
  return HOME_TILES.map((tile) => {
    if (tile.href === "/teamwear") return feedMenuKey("teams");
    if (tile.href === "/shop/kids") return feedMenuKey("kids");
    if (tile.href === "/category/sportswear") return "sportswear";
    if (tile.href === "/category/running-fitness") return "running-fitness";
    if (tile.href === "/category/lifestyle") return "lifestyle";
    if (tile.href === "/category/shoes") return "shoes";
    throw new Error(`Home tile ${tile.id} has no feed key`);
  });
}

export function buildMobileStorefront(catalog: FeedSource[], version: string): MobileStorefront {
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
  const categoryCounts = categoryCountsFromTaxonomy(buildTaxonomy(navVisible));
  const nodes = new Map<string, FeedNode>();

  const put = (node: FeedNodeDraft) => {
    if (nodes.has(node.key)) return;
    const href = table.get(node.key);
    if (!href) return;
    if (!/^\/[^\s\\]*$/.test(href)) {
      throw new Error(`Feed target ${node.key} is not a site path`);
    }
    nodes.set(node.key, { ...node, href });
  };

  const snapshot = jomaFolderMetaSnapshot();
  const siblingIndex = new Map<string, number>();
  const siblingSeen = new Map<string, number>();
  const childrenOf = new Map<string, string[]>();
  for (const row of snapshot) {
    const parent = row.parent ?? "";
    const next = siblingSeen.get(parent) ?? 0;
    siblingIndex.set(row.key, next);
    siblingSeen.set(parent, next + 1);
    if (row.parent) {
      const parentKey = publicFolderKey(row.parent);
      const list = childrenOf.get(parentKey) ?? [];
      list.push(publicFolderKey(row.key));
      childrenOf.set(parentKey, list);
    }
  }

  for (const row of snapshot) {
    const key = publicFolderKey(row.key);
    const count = counts.get(row.key) ?? 0;
    const hidden =
      (isOutletFolderKey(row.key) && count === 0) || (!isLiveFolder(row.key) && count === 0);
    const names = namesFor(key, row.label);
    put(
      emptyNode({
        key,
        kind: "folder",
        ...names,
        order: siblingIndex.get(row.key) ?? 0,
        parent: row.parent ? publicFolderKey(row.parent) : null,
        image: tileImage(jomaFolderTileImage(row.key) || null),
        hidden,
        count,
        group: row.sub ? slugText(row.sub) : null,
      }),
    );
  }
  for (const [key, childKeys] of childrenOf) {
    const node = nodes.get(key);
    if (!node || node.kind !== "folder") continue;
    node.tiles = childKeys.filter((child) => nodes.has(child));
  }

  const categoryOrder: string[] = [];
  for (const category of feedCategoryTargets()) {
    const count = categoryCounts[category.slug] ?? 0;
    const names = copyPair(hubName(category.slug, tEn), hubName(category.slug, tFr));
    const text = blurbs("hub", category.slug);
    const shopKeys =
      category.slug === "sportswear"
        ? sportswearTypeKeys()
        : category.slug === "shoes"
          ? footwearTypeKeys()
          : [];
    const tiles = shopKeys.filter((key) => nodes.has(key));
    const existing = nodes.get(category.slug);
    if (existing) {
      existing.description = existing.description ?? text.description;
      existing.descriptionFr = existing.descriptionFr ?? text.descriptionFr;
      if (shopKeys.length) existing.tiles = tiles;
    } else {
      put(
        emptyNode({
          key: category.slug,
          kind: "category",
          ...names,
          ...text,
          order: category.order,
          parent: null,
          image: tileImage(CATEGORY_IMAGE[category.slug] ?? null),
          hidden: category.slug === "netball" || count === 0,
          count,
          tiles,
        }),
      );
    }
    categoryOrder.push(category.slug);
  }

  for (const audience of feedAudienceTargets()) {
    if (nodes.has(audience.id)) continue;
    const names = copyPair(audienceName(audience.slug, tEn), audienceName(audience.slug, tFr));
    const text = blurbs("audience", audience.slug);
    put(
      emptyNode({
        key: audience.id,
        kind: "audience",
        ...names,
        ...text,
        order: audience.order,
        parent: null,
        image: tileImage(AUDIENCE_IMAGE[audience.slug] ?? null),
        hidden: false,
        count: navVisible.filter((product) => matchesAudience(product, audience.slug)).length,
      }),
    );
  }

  const menuTileIds = (menu: FeedMenuDef) => {
    const ids = menu.tiles.map((tile) => tile.id);
    if (menu.id === "kids") ids.push(KIDS_FOOTWEAR_TILE.id);
    if (menu.id === "shoes") {
      const flow = nodes.get(FLOW_TILE.id);
      if (flow && flow.count > 0) ids.push(FLOW_TILE.id);
    }
    return ids;
  };

  const ensureTile = (tile: FeedTargetTile, parent: string, order: number, hidden = false) => {
    if (nodes.has(tile.id)) return;
    const names = namesFor(tile.folderKey ?? tile.id, tile.label, tile.labelKey);
    const count = tile.folderKey ? (counts.get(tile.folderKey) ?? 0) : 0;
    put(
      emptyNode({
        key: tile.id,
        kind: "tile",
        ...names,
        order,
        parent,
        image: tileImage(tile.image),
        hidden,
        count,
        group: tile.folderKey ? slugText(tile.folderKey) : null,
      }),
    );
  };

  for (const menu of FEED_MENUS) {
    const parent = feedMenuKey(menu.id);
    const ids = menuTileIds(menu);
    ids.forEach((id, order) => {
      const tile = tileById(menu, id);
      if (!tile) return;
      const outlet = menu.id === "outlet";
      const count = tile.folderKey ? (counts.get(tile.folderKey) ?? 0) : 0;
      ensureTile(tile, parent, order, outlet && count === 0);
    });
  }
  ensureTile(
    KIDS_FOOTWEAR_TILE,
    feedMenuKey("kids"),
    FEED_MENUS.find((menu) => menu.id === "kids")?.tiles.length ?? 0,
    false,
  );

  const menuNodes: FeedNode[] = [];
  FEED_MENUS.forEach((menu, order) => {
    const key = feedMenuKey(menu.id);
    const ids = menuTileIds(menu).filter((id) => nodes.has(id));
    const existing = nodes.get(key);
    if (existing && (menu.id === "accessories" || menu.id === "outlet")) {
      existing.tiles = ids;
      menuNodes.push(existing);
      return;
    }
    const names = messagePair(menu.labelKey, menu.label);
    const node = emptyNode({
      key,
      kind: "menu",
      ...names,
      order: order + 1,
      parent: null,
      image: tileImage(menu.image),
      hidden: false,
      count:
        menu.id === "men" || menu.id === "women" || menu.id === "kids"
          ? navVisible.filter((product) => matchesAudience(product, menu.id)).length
          : 0,
      tiles: ids,
    });
    put(node);
    const stored = nodes.get(key);
    if (stored) menuNodes.push(stored);
  });

  const home = messagePair("home.shopTitle", "Shop");
  const homeNode = emptyNode({
    key: feedMenuKey("home"),
    kind: "menu",
    ...home,
    order: 0,
    parent: null,
    image: null,
    hidden: false,
    count: products.length,
    tiles: homeKeys().filter((key) => nodes.has(key)),
  });
  put(homeNode);

  const kidsShoes = navVisible.filter(
    (product) => product.category === "shoes" && productAudience(product) === "kids",
  ).length;
  const footwear = nodes.get(KIDS_FOOTWEAR_TILE.id);
  if (footwear) footwear.count = kidsShoes;

  for (const node of nodes.values()) {
    if (node.parent && !nodes.has(node.parent)) node.parent = null;
    const seen = new Set<string>();
    const tiles: string[] = [];
    for (const key of node.tiles) {
      if (!nodes.has(key) || seen.has(key)) continue;
      seen.add(key);
      tiles.push(key);
    }
    node.tiles = tiles;
  }

  const emitted = new Set<string>();
  const ordered: FeedNode[] = [];
  const take = (key: string) => {
    if (emitted.has(key)) return;
    const node = nodes.get(key);
    if (!node) return;
    emitted.add(key);
    ordered.push(node);
  };
  take(feedMenuKey("home"));
  for (const menu of menuNodes) take(menu.key);
  for (const audience of feedAudienceTargets()) take(audience.id);
  for (const key of categoryOrder) {
    take(key);
    const category = nodes.get(key);
    for (const child of category?.tiles ?? []) take(child);
  }
  for (const row of snapshot) take(publicFolderKey(row.key));
  for (const node of nodes.values()) take(node.key);

  return {
    version: mobileFeedVersion(version),
    nodes: ordered,
    menus: headerMenuKeys(),
    categoryOrder,
    products,
    checkout: feedCheckout(),
    counts: {
      categories: categoryCounts,
      products: products.length,
    },
  };
}

function tileById(menu: FeedMenuDef, id: string): FeedTargetTile | null {
  if (id === KIDS_FOOTWEAR_TILE.id) return KIDS_FOOTWEAR_TILE;
  if (id === FLOW_TILE.id) return FLOW_TILE;
  return menu.tiles.find((tile) => tile.id === id) ?? TEAM_TILES.find((tile) => tile.id === id) ?? null;
}
