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
import { hasUsableProductImage, listingCardCandidates } from "@/lib/media";
import { CANONICAL_SITE_ORIGIN } from "@/lib/meta/site";
import { checkoutVatCountryCodes, checkoutVatRate } from "@/lib/mobile-feed-countries";
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

export type FeedText = { en: string; fr: string };

export type FeedNode = {
  key: string;
  kind: "menu" | "folder" | "category" | "audience" | "tile";
  /** Plain text. fr is always a non-empty string. */
  title: FeedText;
  /** Plain text. fr is always a non-empty string. */
  description: FeedText;
  /** Integer. Site sibling or menu order. */
  order: number;
  parent: string | null;
  image: string | null;
  hidden: boolean;
  /** Integer product count. */
  count: number;
  /** Site base group (`folder.sub`, type folder, or subcategory) when one exists. */
  group: string | null;
  /** Ordered child keys for a menu, category shop-by-type list, or folder. */
  tiles: string[];
  /**
   * Site path from feedTargetTable(). The only link field.
   * Never a request value or a product field.
   * A key that is not in that table is an unknown target and is not emitted.
   */
  target: string;
};

export type FeedProduct = {
  code: string;
  name: string;
  label: string | null;
  labelFr: string | null;
  packLabel: string | null;
  /** Pairs or pieces, or null. Finite integer when present. */
  pairCount: number | null;
  isPack: boolean;
  /** N$. Finite number. */
  price: number;
  priceLabel: string;
  cardImage: string | null;
  images: string[];
  /** Plain text supplier line, or null when the product record has none. */
  line: string | null;
  category: string | null;
  subcategory: string | null;
  audience: string | null;
};

export type FeedCheckout = {
  /** Fraction, not a percent. Namibia rate / 100 (0.15). Display only. */
  vatRate: number;
  /** Euro per 1 N$. Read from eurPerNad(). Display only. */
  eurPerNad: number;
  shipping: Array<{
    key: string;
    title: FeedText;
    /** N$. Finite number. */
    amountNad: number;
  }>;
  /** ISO 3166-1 alpha-2 codes, except Kosovo which is the user-assigned XK. */
  vatCountries: string[];
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

type FeedNodeDraft = Omit<FeedNode, "target">;

export type FeedSource = Product & { folders?: string[] };

const IMAGE_CONTROL = /[\u0000-\u001f\u007f]/;

function fixedSiteOrigin(): URL {
  const origin = new URL(CANONICAL_SITE_ORIGIN);
  if (origin.protocol !== "https:" || origin.port !== "" || origin.pathname !== "/") {
    throw new Error("Canonical site origin is not a fixed https origin");
  }
  return origin;
}

/** Path only, so a query cannot hide a dot segment or a second slash. */
function imagePath(value: string): string {
  const bare = value.split("#")[0]?.split("?")[0] ?? "";
  if (/^https:\/\//i.test(bare)) {
    const rest = bare.replace(/^https:\/\//i, "");
    const slash = rest.indexOf("/");
    return slash === -1 ? "/" : rest.slice(slash);
  }
  return bare;
}

function imagePathRejected(path: string): boolean {
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("//")) return true;
  if (path.includes("\\") || IMAGE_CONTROL.test(path) || /%2e%2e/i.test(path)) return true;
  return path.split("/").some((part) => part === ".." || part === ".");
}

/**
 * Absolute https image, or null when the URL is dropped.
 * A path that starts with one "/" is joined to CANONICAL_SITE_ORIGIN.
 * That origin is the fixed site constant. It is not a request header,
 * an environment variable, or a value from the feed.
 * Protocol-relative URLs, dot segments, backslashes, control characters,
 * and ports are dropped. The absolute URL is kept only when
 * allowedImageHosts() and imageHostAllows() match.
 * A fixed-origin URL that is not on that list is dropped.
 * No host strings are copied here.
 */
export function feedImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed || IMAGE_CONTROL.test(trimmed) || trimmed.includes("\\")) return null;
  const path = imagePath(trimmed);
  if (imagePathRejected(path)) return null;

  let absolute: string;
  if (/^https:\/\//i.test(trimmed)) {
    if (/^https:\/\/[^/?#\s:]+:\d+/i.test(trimmed)) return null;
    absolute = trimmed;
  } else if (trimmed.startsWith("/") && !trimmed.startsWith("//")) {
    absolute = `${CANONICAL_SITE_ORIGIN}${trimmed}`;
  } else {
    return null;
  }

  let parsed: URL;
  try {
    parsed = new URL(absolute);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:" || parsed.port !== "") return null;
  if (parsed.username !== "" || parsed.password !== "") return null;
  if (imagePathRejected(parsed.pathname)) return null;

  fixedSiteOrigin();
  const listed = allowedImageHosts().some((rule) =>
    imageHostAllows(parsed.hostname, parsed.pathname, rule),
  );
  if (!listed) return null;
  return absolute;
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

/** fr is the French plain text, or the English plain text when that is empty. */
function textPair(english: string, french: string, backup = ""): FeedText {
  const en = plainText(english) || plainText(backup);
  const fr = plainText(french) || en;
  if (!en || !fr) throw new Error("Feed French text is empty");
  return { en, fr };
}

export function assertFiniteNumber(value: number, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${label} is not a finite number`);
  }
  return value;
}

export function assertFiniteInteger(value: number, label: string): number {
  const next = assertFiniteNumber(value, label);
  if (!Number.isInteger(next)) throw new Error(`${label} is not an integer`);
  return next;
}

function messagePair(key: string, fallback: string) {
  const english = tEn(key);
  const french = tFr(key);
  return {
    title: textPair(
      english === key ? fallback : english,
      french === key ? fallback : french,
      fallback,
    ),
  };
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
  return { title: textPair(en, fr, english || key) };
}

function descriptionFor(
  kind: "hub" | "audience",
  slug: string,
  title: FeedText,
): FeedText {
  const read = kind === "hub" ? hubBlurb : audienceBlurb;
  const english = plainText(read(slug, tEn));
  const french = plainText(read(slug, tFr));
  if (!english && !french) return title;
  return textPair(english || title.en, french || english || title.fr, title.en);
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
  const pairCount = view.pairCount;
  if (pairCount !== null) assertFiniteInteger(pairCount, `pairCount ${product.code}`);
  return {
    code: product.code,
    name,
    label,
    labelFr: label ? labelFr || label : null,
    packLabel: label,
    pairCount,
    isPack: view.isPack,
    price: assertFiniteNumber(product.price, `price ${product.code}`),
    priceLabel: formatPrice(product.price),
    cardImage: images[0] ?? null,
    images,
    line: productLine(product),
    category: slugText(product.category),
    subcategory: slugText(product.subcategory),
    audience: productAudience(product),
  };
}

function productLine(product: Product): string | null {
  const raw = (product as Product & { line?: unknown }).line;
  if (typeof raw !== "string") return null;
  const text = plainText(raw);
  return text || null;
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

function emptyNode(
  partial: Omit<FeedNodeDraft, "tiles" | "description" | "group"> & {
    tiles?: string[];
    description?: FeedText;
    group?: string | null;
  },
): FeedNodeDraft {
  return {
    group: null,
    tiles: [],
    ...partial,
    description: partial.description ?? partial.title,
  };
}

/**
 * Display only. The server stays the only source of real prices, shipping, and VAT at order time.
 * No checkout or payment route reads this block.
 */
function feedCheckout(): FeedCheckout {
  const eur = eurPerNad();
  if (!Number.isFinite(eur) || eur <= 0) {
    throw new Error("eurPerNad must be a finite number greater than 0");
  }
  const vatRate = checkoutVatRate();
  return {
    vatRate,
    eurPerNad: eur,
    shipping: shippingMethodsSnapshot().map((method) => {
      const amountNad = assertFiniteNumber(method.cost, `amountNad ${method.id}`);
      if (amountNad < 0) throw new Error(`amountNad is negative: ${method.id}`);
      return {
        key: method.id,
        title: textPair(method.name, shippingName(method.id, method.name, tFr), method.name),
        amountNad,
      };
    }),
    vatCountries: checkoutVatCountryCodes(),
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
    if (!node.title.fr || !node.description.fr) {
      throw new Error(`Feed French text is empty: ${node.key}`);
    }
    assertFiniteInteger(node.order, `order ${node.key}`);
    const count = assertFiniteInteger(node.count, `count ${node.key}`);
    if (count < 0) throw new Error(`Feed count is negative: ${node.key}`);
    const target = table.get(node.key);
    if (!target) return;
    if (!/^\/[^\s\\]*$/.test(target)) {
      throw new Error(`Feed target ${node.key} is not a site path`);
    }
    nodes.set(node.key, { ...node, target });
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
    const names = { title: textPair(hubName(category.slug, tEn), hubName(category.slug, tFr), category.slug) };
    const text = descriptionFor("hub", category.slug, names.title);
    const shopKeys =
      category.slug === "sportswear"
        ? sportswearTypeKeys()
        : category.slug === "shoes"
          ? footwearTypeKeys()
          : [];
    const tiles = shopKeys.filter((key) => nodes.has(key));
    const existing = nodes.get(category.slug);
    if (existing) {
      existing.description = text;
      if (shopKeys.length) existing.tiles = tiles;
    } else {
      put(
        emptyNode({
          key: category.slug,
          kind: "category",
          ...names,
          description: text,
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
    const names = {
      title: textPair(audienceName(audience.slug, tEn), audienceName(audience.slug, tFr), audience.slug),
    };
    const text = descriptionFor("audience", audience.slug, names.title);
    put(
      emptyNode({
        key: audience.id,
        kind: "audience",
        ...names,
        description: text,
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

  for (const [slug, count] of Object.entries(categoryCounts)) {
    const next = assertFiniteInteger(count, `category count ${slug}`);
    if (next < 0) throw new Error(`Category count is negative: ${slug}`);
  }

  return {
    version: mobileFeedVersion(version),
    nodes: ordered,
    menus: headerMenuKeys(),
    categoryOrder,
    products,
    checkout: feedCheckout(),
    counts: {
      categories: categoryCounts,
      products: assertFiniteInteger(products.length, "counts.products"),
    },
  };
}

function tileById(menu: FeedMenuDef, id: string): FeedTargetTile | null {
  if (id === KIDS_FOOTWEAR_TILE.id) return KIDS_FOOTWEAR_TILE;
  if (id === FLOW_TILE.id) return FLOW_TILE;
  return menu.tiles.find((tile) => tile.id === id) ?? TEAM_TILES.find((tile) => tile.id === id) ?? null;
}
