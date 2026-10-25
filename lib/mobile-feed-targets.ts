import { AUDIENCES, CATEGORIES, SUBCATEGORY_LABELS, TYPE_FOLDER_ORDER } from "@/lib/catalog";
import {
  jomaAccessoriesLinks,
  jomaAudienceLinks,
  jomaOfficialKitsLinks,
  jomaOutletLinks,
  type JomaAudienceLink,
} from "@/lib/joma-nav-links";
import {
  ACCESSORIES_FOLDERS,
  APPAREL_FOLDERS,
  FOOTWEAR_FOLDERS,
  KIDS_APPAREL_FOLDERS,
  KIDS_FOOTWEAR_FOLDERS,
  OFFICIAL_KITS_FOLDERS,
  OUTLET_FOLDERS,
  WOMAN_APPAREL_FOLDERS,
  WOMAN_FOOTWEAR_FOLDERS,
  type JomaFolderDef,
} from "@/lib/joma-tree";
import { publicFolderKey } from "@/lib/mobile-feed-slugs";

export type FeedTargetTile = {
  id: string;
  label: string;
  href: string;
  image: string;
  folderKey?: string;
};

const MEN_COVER = "/brand/audience-men.png?v=3";
const WOMEN_COVER = "/brand/audience-women.png?v=4";
const SPORT_COVER = "/brand/hub-sportswear.png";
const SHOE_COVER = "/brand/hub-shoes.png";
const TEAM_COVER = "/brand/hub-teampro-2026.webp";

function tilesFromLinks(
  links: readonly JomaAudienceLink[],
  image: string,
  prefix: string,
): FeedTargetTile[] {
  const tiles: FeedTargetTile[] = [];
  const seen = new Set<string>();
  links.forEach((link, index) => {
    const group = new URL(link.href, "https://rappi.local").searchParams.get("group");
    const id = `${prefix}${group ?? `link-${index}`}`;
    if (seen.has(id)) return;
    seen.add(id);
    tiles.push({
      id,
      label: link.label,
      href: link.href,
      image,
      ...(group ? { folderKey: group } : {}),
    });
  });
  return tiles;
}

export const HOME_TILES: readonly FeedTargetTile[] = [
  { id: "teamwear", label: "Teamwear", href: "/teamwear", image: TEAM_COVER },
  { id: "sportswear", label: "Sportswear", href: "/category/sportswear", image: SPORT_COVER },
  { id: "running", label: "Running", href: "/category/running-fitness", image: SHOE_COVER },
  { id: "lifestyle", label: "Lifestyle", href: "/category/lifestyle", image: SPORT_COVER },
  { id: "footwear", label: "Footwear", href: "/category/shoes", image: SHOE_COVER },
  { id: "kids", label: "Kids", href: "/shop/kids", image: SPORT_COVER },
];

/** Men and women tiles are jomaAudienceLinks(), in that function's order. */
export const MEN_TILES: readonly FeedTargetTile[] = tilesFromLinks(jomaAudienceLinks("men"), MEN_COVER, "men-");
export const WOMEN_TILES: readonly FeedTargetTile[] = tilesFromLinks(jomaAudienceLinks("women"), WOMEN_COVER, "women-");

export const KIDS_TILES: readonly FeedTargetTile[] = [
  { id: "kids-1-4", label: "1-4 years", href: "/shop/kids?age=1-4", image: SPORT_COVER, folderKey: "kids-1-4" },
  { id: "kids-6-10", label: "6-10 years", href: "/shop/kids?age=6-10", image: SPORT_COVER, folderKey: "kids-6-10" },
  {
    id: "kids-12-14-boy",
    label: "12-14 year old boy",
    href: "/shop/kids?age=12-14&gender=boy",
    image: SPORT_COVER,
    folderKey: "kids-12-14-boy",
  },
  {
    id: "kids-12-14-girl",
    label: "12-14 year old girl",
    href: "/shop/kids?age=12-14&gender=girl",
    image: SPORT_COVER,
    folderKey: "kids-12-14-girl",
  },
];

export const SHOE_TILES: readonly FeedTargetTile[] = [
  { id: "shoes-men", label: "Men", href: "/shop/shoes?audience=men", image: SHOE_COVER },
  { id: "shoes-women", label: "Women", href: "/shop/shoes?audience=women", image: SHOE_COVER },
  { id: "shoes-kids", label: "Kids", href: "/shop/shoes?audience=kids", image: SHOE_COVER },
  { id: "shoes-outlet", label: "Outlet", href: "/shop/shoes?group=footwear-outlet", image: SHOE_COVER, folderKey: "footwear-outlet" },
];

/** Shown on the footwear menu only while the folder has products. */
export const FLOW_TILE: FeedTargetTile = {
  id: "flow",
  label: "Flow",
  href: "/shop/shoes?group=flow",
  image: SHOE_COVER,
  folderKey: "joma-flow",
};

/** Full accessories, kits, and outlet lists from lib/joma-nav-links. */
export const ACCESSORY_TILES: readonly FeedTargetTile[] = tilesFromLinks(jomaAccessoriesLinks(), SPORT_COVER, "");
export const KIT_TILES: readonly FeedTargetTile[] = tilesFromLinks(jomaOfficialKitsLinks(), TEAM_COVER, "");
export const PROMO_TILES: readonly FeedTargetTile[] = tilesFromLinks(jomaOutletLinks(), SPORT_COVER, "");

export type FeedMenuDef = {
  id: string;
  slug: string;
  label: string;
  href: string;
  image: string;
  tiles: readonly FeedTargetTile[];
};

export const FEED_MENUS: readonly FeedMenuDef[] = [
  { id: "men", slug: "men", label: "Men", href: "/shop/men", image: MEN_COVER, tiles: MEN_TILES },
  { id: "women", slug: "women", label: "Women", href: "/shop/women", image: WOMEN_COVER, tiles: WOMEN_TILES },
  { id: "kids", slug: "kids", label: "Kids", href: "/shop/kids", image: SPORT_COVER, tiles: KIDS_TILES },
  { id: "shoes", slug: "shoes", label: "Footwear", href: "/shop/shoes", image: SHOE_COVER, tiles: SHOE_TILES },
  { id: "kits", slug: "kits", label: "Kits", href: "/teamwear", image: TEAM_COVER, tiles: KIT_TILES },
  { id: "accessories", slug: "accessories", label: "Accessories", href: "/shop/balls-bags", image: SPORT_COVER, tiles: ACCESSORY_TILES },
  { id: "outlet", slug: "outlet", label: "Outlet", href: "/promotions", image: SPORT_COVER, tiles: PROMO_TILES },
  { id: "teamwear", slug: "teamwear", label: "Teamwear", href: "/teamwear", image: TEAM_COVER, tiles: KIT_TILES },
];

function groupHref(base: string, key: string): string {
  const slug = publicFolderKey(key);
  return `${base}${base.includes("?") ? "&" : "?"}group=${encodeURIComponent(slug)}`;
}

function buildFolderHrefs(): Map<string, string> {
  const hrefs = new Map<string, string>();
  const visit = (folders: readonly JomaFolderDef[], base: string) => {
    for (const folder of folders) {
      hrefs.set(folder.key, groupHref(base, folder.key));
      if (folder.children?.length) visit(folder.children, base);
    }
  };
  visit(FOOTWEAR_FOLDERS, "/shop/shoes");
  visit(WOMAN_FOOTWEAR_FOLDERS, "/shop/shoes?audience=women");
  visit(KIDS_FOOTWEAR_FOLDERS, "/shop/kids");
  visit(KIDS_APPAREL_FOLDERS, "/shop/kids");
  visit(WOMAN_APPAREL_FOLDERS, "/shop/women");
  visit(APPAREL_FOLDERS, "/shop/men");
  visit(OUTLET_FOLDERS, "/promotions");
  visit(ACCESSORIES_FOLDERS, "/shop/balls-bags");
  visit(OFFICIAL_KITS_FOLDERS, "/teamwear");
  return hrefs;
}

let folderHrefs: Map<string, string> | null = null;

export function folderHref(key: string): string | null {
  folderHrefs ??= buildFolderHrefs();
  return folderHrefs.get(key) ?? null;
}

export function folderHrefEntries(): ReadonlyMap<string, string> {
  folderHrefs ??= buildFolderHrefs();
  return folderHrefs;
}

export function categoryTargetId(slug: string) {
  return `category:${slug}`;
}

export function categoryHref(slug: string) {
  return `/category/${encodeURIComponent(slug)}`;
}

export function subcategoryTargetId(slug: string, sub: string) {
  return `category:${slug}:sub:${sub}`;
}

export function subcategoryHref(slug: string, sub: string) {
  return `/shop/${encodeURIComponent(slug)}?sub=${encodeURIComponent(sub)}`;
}

export function typeFolderTargetId(slug: string, group: string) {
  return `category:${slug}:group:${group}`;
}

export function typeFolderHref(slug: string, group: string) {
  return `/shop/${encodeURIComponent(slug)}?group=${encodeURIComponent(group)}`;
}

export function feedAudienceTargets() {
  return AUDIENCES.map((audience, order) => ({
    id: `audience:${audience.slug}`,
    slug: audience.slug,
    label: audience.name,
    href: `/shop/${audience.slug}`,
    order,
  }));
}

export function feedCategoryTargets() {
  return CATEGORIES.map((category, order) => ({
    slug: category.slug,
    label: category.name,
    order,
    targetId: categoryTargetId(category.slug),
    href: categoryHref(category.slug),
  }));
}

/** Subcategory href only when the slug and the sub are in the site's constant tables. */
export function feedSubcategoryTarget(slug: string, sub: string) {
  if (!CATEGORIES.some((category) => category.slug === slug)) return null;
  const label = SUBCATEGORY_LABELS[sub];
  if (!label) return null;
  return {
    slug: sub,
    label,
    targetId: subcategoryTargetId(slug, sub),
    href: subcategoryHref(slug, sub),
  };
}

export function feedTypeFolderTarget(slug: string, group: string) {
  if (!CATEGORIES.some((category) => category.slug === slug)) return null;
  if (!(TYPE_FOLDER_ORDER as readonly string[]).includes(group)) return null;
  return {
    slug: group,
    label: SUBCATEGORY_LABELS[group] ?? group,
    targetId: typeFolderTargetId(slug, group),
    href: typeFolderHref(slug, group),
  };
}

function constantTiles(): FeedTargetTile[] {
  return [
    ...HOME_TILES,
    ...MEN_TILES,
    ...WOMEN_TILES,
    ...KIDS_TILES,
    ...SHOE_TILES,
    FLOW_TILE,
    ...ACCESSORY_TILES,
    ...KIT_TILES,
    ...PROMO_TILES,
  ];
}

let targetTable: Map<string, string> | null = null;

/**
 * Id to href. Ids are the only link values nodes may carry.
 * Hrefs come from joma-nav-links, the folder trees, and the category constants.
 */
export function feedTargetTable(): ReadonlyMap<string, string> {
  if (targetTable) return targetTable;
  const map = new Map<string, string>();
  const add = (id: string, href: string) => {
    const existing = map.get(id);
    if (existing && existing !== href) {
      throw new Error(`Feed target ${id} points at two hrefs`);
    }
    map.set(id, href);
  };
  for (const tile of constantTiles()) add(tile.id, tile.href);
  for (const menu of FEED_MENUS) add(`menu:${menu.id}`, menu.href);
  for (const audience of feedAudienceTargets()) add(audience.id, audience.href);
  for (const category of CATEGORIES) {
    add(categoryTargetId(category.slug), categoryHref(category.slug));
    for (const sub of Object.keys(SUBCATEGORY_LABELS)) {
      add(subcategoryTargetId(category.slug, sub), subcategoryHref(category.slug, sub));
    }
    for (const group of TYPE_FOLDER_ORDER) {
      add(typeFolderTargetId(category.slug, group), typeFolderHref(category.slug, group));
    }
  }
  for (const [key, href] of folderHrefEntries()) add(`folder:${publicFolderKey(key)}`, href);
  targetTable = map;
  return map;
}

/** Every href the feed is allowed to emit. Built from this module, not from a request. */
export function feedTargetSet(): ReadonlySet<string> {
  return new Set(feedTargetTable().values());
}
