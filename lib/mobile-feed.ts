import { matchesAudience, productAudience } from "@/lib/audience";
import { clientAssortment, renderAssortmentLabel } from "@/lib/assortment";
import { AUDIENCES } from "@/lib/catalog";
import { DPO_TEST_CODE } from "@/lib/dpo-test-product";
import { formatPrice } from "@/lib/format";
import {
  audienceTiles,
  footwearLandingTiles,
  sportSeriesFolders,
  subcategoryHubGroups,
  type HubFolderTile,
} from "@/lib/hubs";
import { asHomeSpan, asHomeTone } from "@/lib/home-tiles";
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
import { sortByFolderOrder } from "@/lib/folder-order";
import { isLiveFolder } from "@/lib/joma-live";
import { isJomaBrowseFolder } from "@/lib/joma-folder-meta";
import { itemFamilyOf, productLineLabel } from "@/lib/joma-item";
import { jomaTeamsLandingTiles } from "@/lib/joma-nav";
import { jomaFolderTileImage, jomaLandingTileImage } from "@/lib/joma-tile-images";
import { isOutletFolderKey, jomaFolderByKey, jomaFolderMetaSnapshot } from "@/lib/joma-tree";
import { catalogProductFields, filterListing, type ListingItem } from "@/lib/listing-core";
import { hasUsableProductImage, listingCardCandidates, tileImageUrl } from "@/lib/media";
import { CANONICAL_SITE_ORIGIN } from "@/lib/meta/site";
import { checkoutCountries, type FeedCheckoutCountry } from "@/lib/mobile-feed-countries";
import {
  FEED_EXCLUDED_FOLDER_KEY,
  FEED_MENUS,
  HOME_TILES,
  KIDS_FOOTWEAR_TILE,
  SHOE_TILES,
  TEAM_TILES,
  feedAudienceTargets,
  feedCategoryTargets,
  feedMenuKey,
  feedTargetFor,
  headerMenuKeys,
  namespacedFeedTargets,
  type FeedMenuDef,
  type FeedTargetTile,
} from "@/lib/mobile-feed-targets";
import { feedVersionParamStatus, mobileFeedVersion } from "@/lib/mobile-feed-version";
import { publicCopy, publicFolderKey } from "@/lib/mobile-feed-slugs";
import { shippingMethodsSnapshot } from "@/lib/shipping";
import { EMPTY_FOLDER_CODES, TILE_GALLERY_FILE, TILE_PRODUCT_CODES } from "@/lib/tile-cover-pins";
import { buildTaxonomy, categoryCountsFromTaxonomy } from "@/lib/taxonomy";
import type { Product } from "@/lib/types";

const tEn = makeT("na");
const tFr = makeT("eu");

export type FeedText = { en: string; fr: string };

/** One audience row on a category node. label is plain text. target is a fixed literal. */
export type FeedAudienceRef = {
  id: string;
  label: FeedText;
  /** Finite integer. Same count audienceTiles() returns. */
  count: number;
  target: string;
};

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
  /** Home tiles only. 1 or 2, or null when this node is not a home tile. */
  span: 1 | 2 | null;
  /** Home tiles only. dark or light, or null when this node is not a home tile. */
  tone: "dark" | "light" | null;
  /** Audience nodes only. men, women, or kids. Null on every other kind. */
  slug: string | null;
  /**
   * Per-hub audiences. Empty unless audienceTiles() returns more than one,
   * which is the same rule the category page uses.
   */
  audiences: FeedAudienceRef[];
  /**
   * Site path from the fixed target table. The only link field.
   * A namespaced id reads the namespaced literal map.
   * Never a request value or a product field.
   * A key with no fixed target is not emitted.
   */
  target: string;
};

/** Product object keys, in the order the feed emits them. */
export const FEED_PRODUCT_KEYS = [
  "code",
  "name",
  "label",
  "labelFr",
  "packLabel",
  "pairCount",
  "isPack",
  "price",
  "priceLabel",
  "cardImage",
  "images",
  "line",
  "category",
  "subcategory",
  "audience",
] as const;

export type FeedProduct = {
  code: string;
  name: string;
  label: string | null;
  /** Plain text French card badge. Null when label is null. */
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
  /**
   * Plain text from productLineLabel. Null when that label is empty.
   * This branch's label function returns "" until the line module is stacked.
   */
  line: string | null;
  category: string | null;
  subcategory: string | null;
  audience: string | null;
};

export type FeedCheckout = {
  /**
   * One row per VAT_COUNTRIES entry, in that order.
   * code is the fixed ISO alpha-2 (Kosovo is the user-assigned XK).
   * name is the site country name. vatRate is that row's rate / 100.
   * Display only.
   */
  countries: FeedCheckoutCountry[];
  /** Euro per 1 N$. Read from eurPerNad(). Display only. */
  eurPerNad: number;
  shipping: Array<{
    key: string;
    title: FeedText;
    /** N$. Finite number. */
    amountNad: number;
  }>;
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
 * userinfo, and ports are dropped. The absolute URL is kept when its
 * origin is exactly CANONICAL_SITE_ORIGIN, or when allowedImageHosts()
 * and imageHostAllows() match. Any other origin is dropped.
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

  const site = fixedSiteOrigin();
  const onCanonical = parsed.origin === site.origin;
  const listed = allowedImageHosts().some((rule) =>
    imageHostAllows(parsed.hostname, parsed.pathname, rule),
  );
  if (!onCanonical && !listed) return null;
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

const CATALOG_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const GROUP_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const AUDIENCE_SLUGS = new Set<string>(AUDIENCES.map((audience) => audience.slug));

/** Catalog slug as stored. No publicCopy pass, so a brand prefix cannot change it. */
function catalogSlug(value: string | null | undefined): string | null {
  if (!value || !CATALOG_SLUG.test(value)) return null;
  return value;
}

/**
 * Folder group through publicFolderKey, then the public slug pattern.
 * publicCopy is not used here. It strips a brand prefix and can leave a leading hyphen.
 */
function feedGroup(value: string | null | undefined): string | null {
  if (!value) return null;
  const key = publicFolderKey(value);
  if (!GROUP_SLUG.test(key)) return null;
  return key;
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

/** Sport category nodes whose picture is the teams landing tile, not a hub plate. */
const TEAM_CATEGORY_SLUGS = new Set(["football", "basketball", "swimming", "rugby", "cricket"]);

/**
 * Folder nodes filled from the same product photo the site tile uses.
 * Checked live pages that show a product photo, plus the pinned accessory folders.
 * Unchecked kids folders are omitted on purpose.
 */
const FOLDER_PRODUCT_PHOTO = new Set([
  "resort",
  "w-resort",
  "acc-backpacks",
  "acc-tiendas",
  "k14-outerwear-chubasqueros",
  "k14-outerwear-anoracks-jackets",
  "jp-86ae5088b9",
  "k14-pants-pants-largos",
]);

const PHOTO_SKIP = /\/default\.jpe?g(\?|$)/i;

function usablePhotoUrl(url: string | null | undefined): string {
  if (!url || PHOTO_SKIP.test(url) || url.startsWith("/brand/")) return "";
  return url;
}

function photographed(product: FeedSource): boolean {
  if (!hasUsableProductImage(product)) return false;
  const urls = [product.imageUrl, ...(product.images ?? [])];
  return urls.some((url) => Boolean(usablePhotoUrl(url)));
}

function productByCode(catalog: FeedSource[], code: string | undefined): FeedSource | null {
  if (!code) return null;
  const product = catalog.find((row) => row.code === code || row.id === code) ?? null;
  if (!product || !photographed(product)) return null;
  return product;
}

function inFolderPhoto(key: string, catalog: FeedSource[]): FeedSource | null {
  const rows = catalog.filter((product) => (product.folders ?? []).includes(key) && photographed(product));
  if (!rows.length) return null;
  return sortByFolderOrder(key, rows)[0] ?? null;
}

function familyPhoto(key: string, catalog: FeedSource[]): FeedSource | null {
  const folder = jomaFolderByKey(key);
  if (!folder) return null;
  const needles = new Set<string>();
  for (const name of [...(folder.families ?? []), ...(folder.exactFamilies ?? [])]) {
    const norm = itemFamilyOf({ item: name });
    if (norm.length >= 3) needles.add(norm);
  }
  if (!needles.size) return null;
  for (const product of catalog) {
    if (!needles.has(itemFamilyOf(product))) continue;
    if (folder.sport && product.category !== folder.sport && !product.hubs?.includes(folder.sport)) continue;
    if (photographed(product)) return product;
  }
  return null;
}

/**
 * Product photo for a folder tile. Same choice as the site folder picture:
 * pinned gallery file, pinned product, in-folder photo, empty-folder pin, then family.
 * Brand plates are not returned. The caller still runs the URL through feedImageUrl.
 */
function folderProductPhoto(key: string, catalog: FeedSource[]): string {
  const pin = productByCode(catalog, TILE_PRODUCT_CODES[key]);
  const file = TILE_GALLERY_FILE[key];
  if (pin && file) {
    const frame = pin.images?.find((url) => url.endsWith(file)) ?? "";
    if (frame) return frame;
  }
  const sample =
    pin ??
    inFolderPhoto(key, catalog) ??
    productByCode(catalog, EMPTY_FOLDER_CODES[key]) ??
    familyPhoto(key, catalog);
  if (!sample) return "";
  return usablePhotoUrl(tileImageUrl(sample));
}

function teamLandingLabel(slug: string): string | null {
  const href = `/shop/${slug}`;
  const tile = jomaTeamsLandingTiles().find((row) => row.href.split("?")[0] === href);
  return tile?.label ?? null;
}

function categoryImageSource(slug: string): string | null {
  if (TEAM_CATEGORY_SLUGS.has(slug)) {
    const label = teamLandingLabel(slug);
    if (!label) return null;
    return jomaLandingTileImage("teams", label) || null;
  }
  return CATEGORY_IMAGE[slug] ?? null;
}

function folderImageSource(key: string, catalog: FeedSource[]): string | null {
  const exact = jomaFolderTileImage(key);
  if (exact) return exact;
  if (!FOLDER_PRODUCT_PHOTO.has(key)) return null;
  return folderProductPhoto(key, catalog) || null;
}

export function feedProductCard(product: Product): FeedProduct | null {
  if (product.code === DPO_TEST_CODE || product.available === false) return null;
  if (!hasUsableProductImage(product)) return null;
  const view = clientAssortment(product);
  const base = product.displayName || product.name || product.code;
  const suffix = view.titleSuffix ?? "";
  const suffixText = suffix.replace(/^ · /, "");
  const combined = suffixText && !base.includes(suffixText) ? `${base}${suffix}` : base;
  const name = plainText(combined) || product.code;
  const label = view.label ? plainText(view.label) || null : null;
  // French card badge: labelKey and labelParams through t() for the French locale.
  // The strings live in the site messages. This file has no French literals.
  const renderedFr = renderAssortmentLabel(view.labelKey, view.labelParams, tFr, view.label);
  const labelFr = label && renderedFr ? plainText(renderedFr) || null : null;
  const images = productImages(product);
  const pairCount = view.pairCount;
  if (pairCount !== null) assertFiniteInteger(pairCount, `pairCount ${product.code}`);
  const fields = catalogProductFields(product);
  return {
    code: product.code,
    name,
    label,
    labelFr,
    packLabel: label,
    pairCount,
    isPack: view.isPack,
    price: assertFiniteNumber(product.price, `price ${product.code}`),
    priceLabel: formatPrice(product.price),
    cardImage: images[0] ?? null,
    images,
    line: productLine(product),
    category: catalogSlug(fields.category),
    subcategory: catalogSlug(fields.subcategory),
    audience: productAudience(product),
  };
}

function productLine(product: Product): string | null {
  const text = plainText(productLineLabel(product.item));
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
  partial: Omit<FeedNodeDraft, "tiles" | "description" | "group" | "span" | "tone" | "slug" | "audiences"> & {
    tiles?: string[];
    description?: FeedText;
    group?: string | null;
    span?: FeedNode["span"];
    tone?: FeedNode["tone"];
    slug?: string | null;
    audiences?: FeedAudienceRef[];
  },
): FeedNodeDraft {
  return {
    ...partial,
    group: partial.group ?? null,
    tiles: partial.tiles ?? [],
    span: partial.span ?? null,
    tone: partial.tone ?? null,
    slug: partial.slug ?? null,
    audiences: partial.audiences ?? [],
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
  return {
    countries: checkoutCountries(),
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
  };
}

function homeNodeKey(tile: { id: string; href: string }): string {
  if (tile.href === "/teamwear") return feedMenuKey("teams");
  if (tile.href === "/shop/kids") return feedMenuKey("kids");
  if (tile.href === "/category/sportswear") return "sportswear";
  if (tile.href === "/category/running-fitness") return "running-fitness";
  if (tile.href === "/category/lifestyle") return "lifestyle";
  if (tile.href === "/category/shoes") return "shoes";
  throw new Error(`Home tile ${tile.id} has no feed key`);
}

function homeKeys(): string[] {
  return HOME_TILES.map((tile) => homeNodeKey(tile));
}

function siteGroupTitle(tile: HubFolderTile): { title: FeedText } {
  if (tile.exactName) return { title: textPair(tile.name, tile.name, tile.name) };
  if (tile.nameGroup) {
    const english = groupName(tile.nameGroup.kind, tile.nameGroup.key, tEn);
    const french = groupName(tile.nameGroup.kind, tile.nameGroup.key, tFr);
    const en = english !== tile.nameGroup.key ? english : tile.name;
    const fr = french !== tile.nameGroup.key ? french : tile.name;
    return { title: textPair(en, fr, tile.name) };
  }
  return {
    title: textPair(subName(tile.key, tEn), subName(tile.key, tFr), tile.name),
  };
}

function hubTileImage(tile: HubFolderTile): string | null {
  if (tile.cover) return tile.cover;
  if (tile.sample) {
    const url = tileImageUrl(tile.sample);
    return url || null;
  }
  return null;
}

function hubAudiences(slug: string, catalog: FeedSource[]): FeedAudienceRef[] {
  const tiles = audienceTiles(catalog, { categorySlug: slug });
  if (tiles.length <= 1) return [];
  const rows: FeedAudienceRef[] = [];
  for (const tile of tiles) {
    if (!AUDIENCE_SLUGS.has(tile.key)) continue;
    const id = `${slug}--${tile.key}`;
    const target = namespacedFeedTargets().get(id);
    if (!target || tile.href !== target) continue;
    const count = assertFiniteInteger(tile.count, `audience ${id}`);
    if (count <= 0) continue;
    rows.push({
      id,
      label: textPair(audienceName(tile.key, tEn), audienceName(tile.key, tFr), tile.name),
      count,
      target,
    });
  }
  return rows;
}

export function buildMobileStorefront(catalog: FeedSource[], version: string): MobileStorefront {
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
    const target = feedTargetFor(node.key);
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
    if (row.key === FEED_EXCLUDED_FOLDER_KEY) continue;
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
        image: tileImage(folderImageSource(row.key, catalog)),
        hidden,
        count,
        group: feedGroup(row.sub),
      }),
    );
  }
  for (const [key, childKeys] of childrenOf) {
    const node = nodes.get(key);
    if (!node || node.kind !== "folder") continue;
    node.tiles = childKeys.filter((child) => nodes.has(child));
  }

  const categoryShopTileIds = (slug: string): string[] => {
    if (slug === "shoes") {
      const byHref = new Map(SHOE_TILES.map((tile) => [tile.href, tile.id]));
      const ids: string[] = [];
      for (const tile of footwearLandingTiles(catalog)) {
        const id = byHref.get(tile.href);
        if (!id || ids.includes(id)) continue;
        ids.push(id);
      }
      return ids;
    }
    const typeGroups = subcategoryHubGroups(slug, catalog);
    const series = sportSeriesFolders(slug, catalog).filter(
      (tile) => !typeGroups.some((folder) => folder.key === tile.key),
    );
    const ids: string[] = [];
    for (const tile of [...typeGroups, ...series]) {
      const id = `${slug}--${publicFolderKey(tile.key)}`;
      const target = namespacedFeedTargets().get(id);
      if (!target || tile.href !== target) continue;
      const names = siteGroupTitle(tile);
      put(
        emptyNode({
          key: id,
          kind: "tile",
          ...names,
          order: ids.length,
          parent: slug,
          image: tileImage(hubTileImage(tile)),
          hidden: false,
          count: assertFiniteInteger(tile.count, `count ${id}`),
          group: feedGroup(tile.key),
        }),
      );
      if (nodes.has(id)) ids.push(id);
    }
    return ids;
  };

  const categoryOrder: string[] = [];
  for (const category of feedCategoryTargets()) {
    const count = categoryCounts[category.slug] ?? 0;
    const names = { title: textPair(hubName(category.slug, tEn), hubName(category.slug, tFr), category.slug) };
    const text = descriptionFor("hub", category.slug, names.title);
    const tiles = categoryShopTileIds(category.slug);
    const audiences = hubAudiences(category.slug, catalog);
    const existing = nodes.get(category.slug);
    if (existing) {
      existing.description = text;
      existing.tiles = tiles;
      existing.audiences = audiences;
    } else {
      put(
        emptyNode({
          key: category.slug,
          kind: "category",
          ...names,
          description: text,
          order: category.order,
          parent: null,
          image: tileImage(categoryImageSource(category.slug)),
          hidden: category.slug === "netball" || count === 0,
          count,
          tiles,
          audiences,
        }),
      );
    }
    categoryOrder.push(category.slug);
  }

  for (const audience of feedAudienceTargets()) {
    if (!AUDIENCE_SLUGS.has(audience.slug)) continue;
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
        slug: audience.slug,
      }),
    );
  }

  const menuTileIds = (menu: FeedMenuDef) => {
    const ids = menu.tiles.map((tile) => tile.id);
    if (menu.id === "kids") ids.push(KIDS_FOOTWEAR_TILE.id);
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
        group: feedGroup(tile.folderKey),
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

  for (const tile of HOME_TILES) {
    const node = nodes.get(homeNodeKey(tile));
    if (!node) continue;
    node.span = asHomeSpan(tile.span);
    node.tone = asHomeTone(tile.tone);
  }

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
  return menu.tiles.find((tile) => tile.id === id) ?? TEAM_TILES.find((tile) => tile.id === id) ?? null;
}

/** Long CDN lifetime for the current version. A mismatched valid `v` uses no-store. */
export const STOREFRONT_CACHE = "public, s-maxage=300, stale-while-revalidate=86400";

const builtFeeds = new Map<string, MobileStorefront>();
let storefrontBuilds = 0;

/** How many times this process has built a storefront document. */
export function mobileStorefrontBuildCount(): number {
  return storefrontBuilds;
}

/**
 * One built feed per process per version.
 * A later call with the same version returns the stored document and does not build again.
 */
export function memoizedMobileStorefront(catalog: FeedSource[], version: string): MobileStorefront {
  const key = mobileFeedVersion(version);
  const hit = builtFeeds.get(key);
  if (hit) return hit;
  storefrontBuilds += 1;
  const feed = buildMobileStorefront(catalog, version);
  if (feed.version !== key) throw new Error("Feed version does not match the memo key");
  builtFeeds.set(key, feed);
  return feed;
}

export type StorefrontResult =
  | { status: 400; cacheControl: "no-store"; body: { error: string } }
  | { status: 200; cacheControl: string; body: MobileStorefront };

/**
 * Missing `v` and a `v` equal to the current version are cacheable.
 * A valid `v` that is not the current version returns that same feed with no-store.
 * An invalid `v` is a 400. The supplied text is not copied into the body.
 * Invalid input does not call `read`.
 */
/** Cache decision for an already built feed. Does not build. */
export function storefrontFromFeed(values: readonly string[], feed: MobileStorefront): StorefrontResult {
  if (feedVersionParamStatus(values) === "invalid") {
    return { status: 400, cacheControl: "no-store", body: { error: "Invalid version." } };
  }
  const mismatch = values.length === 1 && values[0] !== feed.version;
  return {
    status: 200,
    cacheControl: mismatch ? "no-store" : STOREFRONT_CACHE,
    body: feed,
  };
}

/**
 * Invalid `v` returns before `read`, so a bad query does not build a feed.
 */
export async function storefrontResult(
  values: readonly string[],
  read: () => Promise<MobileStorefront>,
): Promise<StorefrontResult> {
  if (feedVersionParamStatus(values) === "invalid") {
    return { status: 400, cacheControl: "no-store", body: { error: "Invalid version." } };
  }
  return storefrontFromFeed(values, await read());
}
