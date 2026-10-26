import { AUDIENCES, CATEGORIES } from "@/lib/catalog";
import { jomaAccessoriesLandingTiles, jomaTeamsLandingTiles } from "@/lib/joma-nav";
import {
  jomaAccessoriesLinks,
  jomaAudienceLinks,
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
import { HOME_COVERS } from "@/lib/tile-cover-pins";

export type FeedTargetTile = {
  id: string;
  label: string;
  href: string;
  image: string;
  folderKey?: string;
  /** messages.ts key. The feed reads it. The string is not copied here. */
  labelKey?: string;
  /** Home tiles only: TILE_PRODUCT_CODES key whose product photo the web home shows. */
  pin?: string;
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
  labelKeys?: ReadonlyMap<string, string | undefined>,
): FeedTargetTile[] {
  const tiles: FeedTargetTile[] = [];
  const seen = new Set<string>();
  links.forEach((link, index) => {
    const group = new URL(link.href, "https://rappi.local").searchParams.get("group");
    const id = `${prefix}${group ?? `link-${index}`}`;
    if (seen.has(id)) return;
    seen.add(id);
    const labelKey = labelKeys?.get(link.href);
    tiles.push({
      id,
      label: link.label,
      href: link.href,
      image,
      ...(group ? { folderKey: group } : {}),
      ...(labelKey ? { labelKey } : {}),
    });
  });
  return tiles;
}

const ACCESSORY_LABEL_KEYS = new Map(
  jomaAccessoriesLandingTiles().map((tile) => [tile.href, tile.labelKey] as const),
);

/**
 * Teams landing hrefs use a search word or a shop path.
 * The key is the screen name the released storefront already used.
 */
const TEAM_QUERY_KEYS: Record<string, string> = {
  polyester: "polyester",
  cotton: "cotton",
  volley: "volleyball",
  handball: "handball",
  staff: "coach",
  referee: "referee",
  goalkeeper: "goalie",
};

const TEAM_PATH_KEYS: Record<string, string> = {
  "/shop/football": "football",
  "/shop/basketball": "basketball",
  "/shop/rugby": "rugby",
  "/shop/cricket": "cricket",
  "/shop/swimming": "swimming",
};

export function teamTileId(href: string): string {
  const url = new URL(href, "https://rappi.local");
  const group = url.searchParams.get("group");
  if (group) return group;
  const query = url.searchParams.get("q");
  if (query && TEAM_QUERY_KEYS[query]) return TEAM_QUERY_KEYS[query];
  const path = TEAM_PATH_KEYS[url.pathname];
  if (path) return path;
  throw new Error("Teams tile has no target key");
}

/**
 * The six web home tiles (app/page.tsx and components/home-hero.tsx): same order, labels,
 * links and pictures. Brand covers come from HOME_COVERS (also lib/hubs.ts HUB_COVERS).
 * Running, Lifestyle and Kids show the pinned product photo, as the web home does.
 */
export const HOME_TILES: readonly FeedTargetTile[] = [
  { id: "home-teamwear", label: "Teamwear", labelKey: "home.teamwearEyebrow", href: "/teamwear", image: HOME_COVERS["teampro-2026"] },
  { id: "home-sportswear", label: "Sportswear", labelKey: "hub.sportswear.nav", href: "/category/sportswear", image: HOME_COVERS.sportswear },
  { id: "home-running", label: "Running", labelKey: "hub.running-fitness.nav", href: "/category/running-fitness", image: HOME_COVERS["running-fitness"], pin: "home:running" },
  { id: "home-lifestyle", label: "Lifestyle", labelKey: "hub.lifestyle.name", href: "/category/lifestyle", image: "", pin: "home:lifestyle" },
  { id: "home-footwear", label: "Footwear", labelKey: "hub.shoes.name", href: "/category/shoes", image: HOME_COVERS.shoes },
  { id: "home-kids", label: "Kids", labelKey: "audience.kids.name", href: "/shop/kids", image: "", pin: "home:kids" },
];

/** Men and women tiles are jomaAudienceLinks(), in that function's order. */
export const MEN_TILES: readonly FeedTargetTile[] = tilesFromLinks(jomaAudienceLinks("men"), MEN_COVER, "");
export const WOMEN_TILES: readonly FeedTargetTile[] = tilesFromLinks(jomaAudienceLinks("women"), WOMEN_COVER, "");

/** Header children links. Same four age folders as KIDS_APPAREL_FOLDERS, group query. */
export const KIDS_TILES: readonly FeedTargetTile[] = KIDS_APPAREL_FOLDERS.map((folder) => ({
  id: publicFolderKey(folder.key),
  label: folder.label,
  href: `/shop/kids?group=${encodeURIComponent(publicFolderKey(folder.key))}`,
  image: SPORT_COVER,
  folderKey: folder.key,
}));

/** Fifth kids hub tile from kidsHubGroups. Not an age folder. */
export const KIDS_FOOTWEAR_TILE: FeedTargetTile = {
  id: "kids-footwear",
  label: "Footwear",
  href: "/shop/shoes?audience=kids",
  image: SHOE_COVER,
  labelKey: "group.kids.kids-footwear",
};

export const SHOE_TILES: readonly FeedTargetTile[] = [
  { id: "shoes-men", label: "Men", href: "/shop/shoes?audience=men", image: SHOE_COVER, labelKey: "tiles.men" },
  { id: "shoes-women", label: "Women", href: "/shop/shoes?audience=women", image: SHOE_COVER, labelKey: "tiles.women" },
  { id: "shoes-kids", label: "Kids", href: "/shop/shoes?audience=kids", image: SHOE_COVER, labelKey: "tiles.kids" },
  {
    id: "footwear-outlet",
    label: "Outlet",
    href: "/shop/shoes?group=footwear-outlet",
    image: SHOE_COVER,
    folderKey: "footwear-outlet",
    labelKey: "tiles.outlet",
  },
];

/** Shown on the footwear menu only while the folder has products. */
export const FLOW_TILE: FeedTargetTile = {
  id: "flow",
  label: "Flow",
  href: "/shop/shoes?group=flow",
  image: SHOE_COVER,
  folderKey: "joma-flow",
};

/** Header accessories list. Fourteen links, including socks, which the folder tree dropped. */
export const ACCESSORY_TILES: readonly FeedTargetTile[] = tilesFromLinks(
  jomaAccessoriesLinks(),
  SPORT_COVER,
  "",
  ACCESSORY_LABEL_KEYS,
);

export const PROMO_TILES: readonly FeedTargetTile[] = tilesFromLinks(jomaOutletLinks(), SPORT_COVER, "");

/** Teams grid from jomaTeamsLandingTiles, in that function's order. Not the kit tiles. */
export const TEAM_TILES: readonly FeedTargetTile[] = jomaTeamsLandingTiles().map((tile) => ({
  id: teamTileId(tile.href),
  label: tile.label,
  href: tile.href,
  image: tile.cover || SPORT_COVER,
  ...(tile.labelKey ? { labelKey: tile.labelKey } : {}),
}));

/**
 * Sponsor replicas are the official-kits child that is not federations or special editions.
 * The portal replaced the kits-replicas key. This reads the live tree.
 */
export function sponsorReplicaFolder() {
  const root = OFFICIAL_KITS_FOLDERS[0];
  return (
    root?.children?.find((child) => child.key !== "kits-federations" && child.key !== "kits-special") ??
    null
  );
}

export function sponsorReplicaTiles(): FeedTargetTile[] {
  const node = sponsorReplicaFolder();
  return (node?.children ?? []).map((child) => ({
    id: publicFolderKey(child.key),
    label: child.label,
    href: `/teamwear?group=${encodeURIComponent(publicFolderKey(child.key))}`,
    image: TEAM_COVER,
    folderKey: child.key,
  }));
}

/** Shop-by-type folders, site array order. Footwear omits outlet, which is a landing tile. */
export function sportswearTypeKeys(): string[] {
  return APPAREL_FOLDERS.map((folder) => publicFolderKey(folder.key));
}

export function footwearTypeKeys(): string[] {
  return FOOTWEAR_FOLDERS.filter((folder) => folder.key !== "footwear-outlet").map((folder) =>
    publicFolderKey(folder.key),
  );
}

export function kidsAgeChildren(): Array<{ key: string; parent: string }> {
  const rows: Array<{ key: string; parent: string }> = [];
  for (const band of KIDS_APPAREL_FOLDERS) {
    const parent = publicFolderKey(band.key);
    for (const child of band.children ?? []) {
      rows.push({ key: publicFolderKey(child.key), parent });
    }
  }
  return rows;
}

export type FeedMenuDef = {
  id: string;
  slug: string;
  label: string;
  labelKey: string;
  href: string;
  image: string;
  tiles: readonly FeedTargetTile[];
};

export const FEED_MENUS: readonly FeedMenuDef[] = [
  { id: "men", slug: "men", label: "Man", labelKey: "nav.man", href: "/shop/men", image: MEN_COVER, tiles: MEN_TILES },
  { id: "women", slug: "women", label: "Woman", labelKey: "nav.woman", href: "/shop/women", image: WOMEN_COVER, tiles: WOMEN_TILES },
  { id: "kids", slug: "kids", label: "Children", labelKey: "nav.children", href: "/shop/kids", image: SPORT_COVER, tiles: KIDS_TILES },
  { id: "shoes", slug: "shoes", label: "Footwear", labelKey: "nav.footwear", href: "/shop/shoes", image: SHOE_COVER, tiles: SHOE_TILES },
  { id: "teams", slug: "teams", label: "Teams", labelKey: "nav.teams", href: "/teamwear", image: TEAM_COVER, tiles: TEAM_TILES },
  {
    id: "kits",
    slug: "kits",
    label: "Sponsor replicas",
    labelKey: "tiles.kitSponsorReplicas",
    href: "/teamwear?view=kits",
    image: TEAM_COVER,
    tiles: sponsorReplicaTiles(),
  },
  {
    id: "accessories",
    slug: "accessories",
    label: "Accessories",
    labelKey: "nav.accessories",
    href: "/shop/balls-bags",
    image: SPORT_COVER,
    tiles: ACCESSORY_TILES,
  },
  { id: "outlet", slug: "outlet", label: "Outlet", labelKey: "nav.outlet", href: "/promotions", image: SPORT_COVER, tiles: PROMO_TILES },
];

/**
 * Screen keys that do not collide with a folder or a category slug.
 * Accessories and outlet are the folder nodes with those keys.
 */
export const MENU_KEY = {
  home: "home",
  men: "man",
  women: "woman",
  kids: "children",
  shoes: "footwear",
  teams: "teams",
  kits: "kits",
} as const;

export function feedMenuKey(id: string): string {
  if (id === "accessories" || id === "outlet") return id;
  if (id === "home") return MENU_KEY.home;
  const key = MENU_KEY[id as keyof typeof MENU_KEY];
  if (!key) throw new Error(`Menu ${id} has no feed key`);
  return key;
}

export function headerMenuKeys(): string[] {
  return FEED_MENUS.map((menu) => feedMenuKey(menu.id));
}

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

export function categoryHref(slug: string) {
  return `/category/${encodeURIComponent(slug)}`;
}

export function feedAudienceTargets() {
  return AUDIENCES.map((audience, order) => ({
    id: audience.slug,
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
    targetId: category.slug,
    href: categoryHref(category.slug),
  }));
}

function constantTiles(): FeedTargetTile[] {
  return [
    ...HOME_TILES,
    ...MEN_TILES,
    ...WOMEN_TILES,
    ...KIDS_TILES,
    KIDS_FOOTWEAR_TILE,
    ...SHOE_TILES,
    FLOW_TILE,
    ...ACCESSORY_TILES,
    ...TEAM_TILES,
    ...PROMO_TILES,
    ...sponsorReplicaTiles(),
  ];
}

let targetTable: Map<string, string> | null = null;

const TARGET_KEY = /^[A-Za-z0-9][A-Za-z0-9-]*$/;

/**
 * Fixed id to site path. The feed copies this path onto the node as `target`.
 * The path is never read from the request or from a product row.
 * A key that is not in this table is not emitted.
 * The first id wins when a folder and a link share a key.
 * Ids are literal keys. No menu, group, sub, search, or category prefix.
 */
export function feedTargetTable(): ReadonlyMap<string, string> {
  if (targetTable) return targetTable;
  const map = new Map<string, string>();
  const add = (id: string, href: string) => {
    if (!TARGET_KEY.test(id)) throw new Error(`Feed target key is not a fixed id: ${id}`);
    if (map.has(id)) return;
    map.set(id, href);
  };
  for (const tile of constantTiles()) add(tile.id, tile.href);
  add(MENU_KEY.home, "/");
  for (const menu of FEED_MENUS) add(feedMenuKey(menu.id), menu.href);
  for (const audience of feedAudienceTargets()) add(audience.id, audience.href);
  for (const category of CATEGORIES) add(category.slug, categoryHref(category.slug));
  for (const [key, href] of folderHrefEntries()) add(publicFolderKey(key), href);
  targetTable = map;
  return map;
}

export function feedTargetKeys(): ReadonlySet<string> {
  return new Set(feedTargetTable().keys());
}

/** Every href the feed is allowed to emit. Built from this module, not from a request. */
export function feedTargetSet(): ReadonlySet<string> {
  return new Set(feedTargetTable().values());
}
