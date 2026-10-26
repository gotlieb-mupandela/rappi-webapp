import { AUDIENCES, CATEGORIES, TYPE_FOLDERS } from "@/lib/catalog";
import { homeTileLayout, type HomeTileSpan, type HomeTileTone } from "@/lib/home-tiles";
import { sportSeriesRoot } from "@/lib/hubs";
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
  jomaFolderByKey,
  type JomaFolderDef,
} from "@/lib/joma-tree";
import { publicFolderKey } from "@/lib/mobile-feed-slugs";

export type FeedTargetTile = {
  id: string;
  label: string;
  href: string;
  image: string;
  folderKey?: string;
  /** messages.ts key. The feed reads it. The string is not copied here. */
  labelKey?: string;
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

export type HomeFeedTile = FeedTargetTile & {
  span: HomeTileSpan;
  tone: HomeTileTone;
};

function homeFeedTile(
  tile: FeedTargetTile,
): HomeFeedTile {
  const layout = homeTileLayout(tile.id);
  return { ...tile, span: layout.span, tone: layout.tone };
}

export const HOME_TILES: readonly HomeFeedTile[] = [
  homeFeedTile({ id: "teamwear", label: "Teamwear", href: "/teamwear", image: TEAM_COVER }),
  homeFeedTile({ id: "sportswear", label: "Sportswear", href: "/category/sportswear", image: SPORT_COVER }),
  homeFeedTile({ id: "running", label: "Running", href: "/category/running-fitness", image: SHOE_COVER }),
  homeFeedTile({ id: "lifestyle", label: "Lifestyle", href: "/category/lifestyle", image: SPORT_COVER }),
  homeFeedTile({ id: "footwear", label: "Footwear", href: "/category/shoes", image: SHOE_COVER }),
  homeFeedTile({ id: "kids", label: "Kids", href: "/shop/kids", image: SPORT_COVER }),
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

/**
 * Live shoes landing has no Flow tile, so this folder stays out of the feed.
 * The folder row stays in the tree. Only the feed skips it.
 */
export const FEED_EXCLUDED_FOLDER_KEY = "joma-flow";

/** Shown on the footwear menu only while the folder has products. The feed skips it. */
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
  const footballSeries = sportSeriesRoot("football");
  const visit = (folders: readonly JomaFolderDef[], base: string) => {
    for (const folder of folders) {
      if (folder.key === FEED_EXCLUDED_FOLDER_KEY) continue;
      const nextBase = folder.key === footballSeries ? "/shop/football" : base;
      hrefs.set(folder.key, groupHref(nextBase, folder.key));
      if (folder.children?.length) visit(folder.children, nextBase);
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
let namespacedTargets: Map<string, string> | null = null;

const TARGET_KEY = /^[A-Za-z0-9][A-Za-z0-9-]*$/;

/** hub--leaf. Lowercase, one double hyphen, no leading or trailing hyphen. */
export const NAMESPACED_FEED_KEY = /^[a-z0-9]+(?:-[a-z0-9]+)*--[a-z0-9]+(?:-[a-z0-9]+)*$/;

function feedIdExcluded(id: string): boolean {
  return id === publicFolderKey(FEED_EXCLUDED_FOLDER_KEY);
}

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
    if (feedIdExcluded(id)) return;
    if (!TARGET_KEY.test(id)) throw new Error(`Feed target key is not a fixed id: ${id}`);
    if (map.has(id)) return;
    map.set(id, href);
  };
  for (const tile of constantTiles()) {
    if (tile.folderKey === FEED_EXCLUDED_FOLDER_KEY) continue;
    add(tile.id, tile.href);
  }
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

/** Every static href. Built from this module, not from a request. */
export function feedTargetSet(): ReadonlySet<string> {
  return new Set(feedTargetTable().values());
}

/**
 * Header subcategory hrefs. Each value is a complete site path.
 * The id is hub--sub-leaf. The strings come from catalog constants and the
 * baked header list, and they are stored here so a request cannot supply them.
 * npm run gen:sub-links rewrites the committed sub link list.
 * These ids are not feed nodes.
 */
export const SUB_LINK_TARGETS: Readonly<Record<string, string>> = {
  "sportswear--sub-jerseys": "/shop/sportswear?sub=jerseys&group=shirts",
  "sportswear--sub-tees": "/shop/sportswear?sub=tees&group=shirts",
  "sportswear--sub-tees-kids": "/shop/sportswear?sub=tees-kids&group=shirts",
  "sportswear--sub-polos": "/shop/sportswear?sub=polos&group=shirts",
  "sportswear--sub-tops": "/shop/sportswear?sub=tops&group=shirts",
  "sportswear--sub-shorts": "/shop/sportswear?sub=shorts",
  "sportswear--sub-pants": "/shop/sportswear?sub=pants",
  "sportswear--sub-tracksuits": "/shop/sportswear?sub=tracksuits&group=pants",
  "sportswear--sub-leggings": "/shop/sportswear?sub=leggings&group=pants",
  "sportswear--sub-tights": "/shop/sportswear?sub=tights&group=pants",
  "sportswear--sub-skins": "/shop/sportswear?sub=skins&group=pants",
  "sportswear--sub-jackets": "/shop/sportswear?sub=jackets",
  "sportswear--sub-hoodies": "/shop/sportswear?sub=hoodies&group=jackets",
  "sportswear--sub-dresses": "/shop/sportswear?sub=dresses",
  "sportswear--sub-skirts": "/shop/sportswear?sub=skirts",
  "sportswear--sub-bras": "/shop/sportswear?sub=bras",
  "sportswear--sub-football-fg": "/shop/sportswear?sub=football-fg&group=shoes",
  "sportswear--sub-football-ag": "/shop/sportswear?sub=football-ag&group=shoes",
  "sportswear--sub-football-sg": "/shop/sportswear?sub=football-sg&group=shoes",
  "sportswear--sub-protection": "/shop/sportswear?sub=protection&group=accessories",
  "sportswear--sub-gk-gloves": "/shop/sportswear?sub=gk-gloves&group=accessories",
  "sportswear--sub-socks": "/shop/sportswear?sub=socks&group=accessories",
  "sportswear--sub-caps": "/shop/sportswear?sub=caps&group=accessories",
  "sportswear--sub-accessories": "/shop/sportswear?sub=accessories",
  "football--sub-tees": "/shop/football?sub=tees&group=shirts",
  "football--sub-polos": "/shop/football?sub=polos&group=shirts",
  "football--sub-shorts": "/shop/football?sub=shorts",
  "football--sub-pants": "/shop/football?sub=pants",
  "football--sub-tracksuits": "/shop/football?sub=tracksuits&group=pants",
  "football--sub-jackets": "/shop/football?sub=jackets",
  "football--sub-hoodies": "/shop/football?sub=hoodies&group=jackets",
  "football--sub-football-fg": "/shop/football?sub=football-fg&group=shoes",
  "football--sub-football-ag": "/shop/football?sub=football-ag&group=shoes",
  "football--sub-football-sg": "/shop/football?sub=football-sg&group=shoes",
  "football--sub-futsal": "/shop/football?sub=futsal&group=shoes",
  "football--sub-turf": "/shop/football?sub=turf&group=shoes",
  "football--sub-boots": "/shop/football?sub=boots&group=shoes",
  "football--sub-balls": "/shop/football?sub=balls&group=equipment",
  "football--sub-protection": "/shop/football?sub=protection&group=accessories",
  "football--sub-shin-guards": "/shop/football?sub=shin-guards&group=accessories",
  "football--sub-gk-gloves": "/shop/football?sub=gk-gloves&group=accessories",
  "football--sub-socks": "/shop/football?sub=socks&group=accessories",
  "basketball--sub-tees": "/shop/basketball?sub=tees&group=shirts",
  "basketball--sub-shorts": "/shop/basketball?sub=shorts",
  "basketball--sub-pants": "/shop/basketball?sub=pants",
  "basketball--sub-basketball-shoes": "/shop/basketball?sub=basketball-shoes&group=shoes",
  "basketball--sub-socks": "/shop/basketball?sub=socks&group=accessories",
  "swimming--sub-swimwear": "/shop/swimming?sub=swimwear",
  "swimming--sub-shorts": "/shop/swimming?sub=shorts",
  "swimming--sub-caps": "/shop/swimming?sub=caps&group=accessories",
  "rugby--sub-jerseys": "/shop/rugby?sub=jerseys&group=shirts",
  "rugby--sub-shorts": "/shop/rugby?sub=shorts",
  "rugby--sub-balls": "/shop/rugby?sub=balls&group=equipment",
  "rugby--sub-protection": "/shop/rugby?sub=protection&group=accessories",
  "cricket--sub-jerseys": "/shop/cricket?sub=jerseys&group=shirts",
  "cricket--sub-polos": "/shop/cricket?sub=polos&group=shirts",
  "cricket--sub-pants": "/shop/cricket?sub=pants",
  "cricket--sub-hoodies": "/shop/cricket?sub=hoodies&group=jackets",
  "boxing--sub-shorts": "/shop/boxing?sub=shorts",
  "hockey--sub-hockey-shoes": "/shop/hockey?sub=hockey-shoes&group=shoes",
  "running-fitness--sub-tees": "/shop/running-fitness?sub=tees&group=shirts",
  "running-fitness--sub-polos": "/shop/running-fitness?sub=polos&group=shirts",
  "running-fitness--sub-tops": "/shop/running-fitness?sub=tops&group=shirts",
  "running-fitness--sub-shorts": "/shop/running-fitness?sub=shorts",
  "running-fitness--sub-pants": "/shop/running-fitness?sub=pants",
  "running-fitness--sub-tracksuits": "/shop/running-fitness?sub=tracksuits&group=pants",
  "running-fitness--sub-leggings": "/shop/running-fitness?sub=leggings&group=pants",
  "running-fitness--sub-tights": "/shop/running-fitness?sub=tights&group=pants",
  "running-fitness--sub-jackets": "/shop/running-fitness?sub=jackets",
  "running-fitness--sub-hoodies": "/shop/running-fitness?sub=hoodies&group=jackets",
  "running-fitness--sub-skirts": "/shop/running-fitness?sub=skirts",
  "running-fitness--sub-bras": "/shop/running-fitness?sub=bras",
  "running-fitness--sub-running-shoes": "/shop/running-fitness?sub=running-shoes&group=shoes",
  "running-fitness--sub-trail-running": "/shop/running-fitness?sub=trail-running&group=shoes",
  "running-fitness--sub-training-shoes": "/shop/running-fitness?sub=training-shoes&group=shoes",
  "running-fitness--sub-kids-shoes": "/shop/running-fitness?sub=kids-shoes&group=shoes",
  "running-fitness--sub-socks": "/shop/running-fitness?sub=socks&group=accessories",
  "running-fitness--sub-caps": "/shop/running-fitness?sub=caps&group=accessories",
  "running-fitness--sub-accessories": "/shop/running-fitness?sub=accessories",
  "brama--sub-shorts": "/shop/brama?sub=shorts",
  "brama--sub-tights": "/shop/brama?sub=tights&group=pants",
  "brama--sub-skins": "/shop/brama?sub=skins&group=pants",
  "padel--sub-tees": "/shop/padel?sub=tees&group=shirts",
  "padel--sub-polos": "/shop/padel?sub=polos&group=shirts",
  "padel--sub-shorts": "/shop/padel?sub=shorts",
  "padel--sub-tracksuits": "/shop/padel?sub=tracksuits&group=pants",
  "padel--sub-skirts": "/shop/padel?sub=skirts",
  "padel--sub-padel-shoes": "/shop/padel?sub=padel-shoes&group=shoes",
  "padel--sub-bags": "/shop/padel?sub=bags&group=equipment",
  "padel--sub-rackets": "/shop/padel?sub=rackets&group=equipment",
  "padel--sub-accessories": "/shop/padel?sub=accessories",
  "hiking--sub-tees": "/shop/hiking?sub=tees&group=shirts",
  "hiking--sub-pants": "/shop/hiking?sub=pants",
  "hiking--sub-jackets": "/shop/hiking?sub=jackets",
  "hiking--sub-skirts": "/shop/hiking?sub=skirts",
  "hiking--sub-trail-running": "/shop/hiking?sub=trail-running&group=shoes",
  "hiking--sub-outdoor-shoes": "/shop/hiking?sub=outdoor-shoes&group=shoes",
  "resort--sub-tees": "/shop/resort?sub=tees&group=shirts",
  "resort--sub-polos": "/shop/resort?sub=polos&group=shirts",
  "resort--sub-tops": "/shop/resort?sub=tops&group=shirts",
  "resort--sub-shorts": "/shop/resort?sub=shorts",
  "resort--sub-pants": "/shop/resort?sub=pants",
  "resort--sub-leggings": "/shop/resort?sub=leggings&group=pants",
  "resort--sub-jackets": "/shop/resort?sub=jackets",
  "resort--sub-hoodies": "/shop/resort?sub=hoodies&group=jackets",
  "lifestyle--sub-sneakers": "/shop/lifestyle?sub=sneakers&group=shoes",
  "teampro-2026--sub-tees": "/shop/teampro-2026?sub=tees&group=shirts",
  "teampro-2026--sub-polos": "/shop/teampro-2026?sub=polos&group=shirts",
  "teampro-2026--sub-shorts": "/shop/teampro-2026?sub=shorts",
  "teampro-2026--sub-pants": "/shop/teampro-2026?sub=pants",
  "teampro-2026--sub-jackets": "/shop/teampro-2026?sub=jackets",
  "shoes--sub-football-fg": "/shop/shoes?sub=football-fg&group=shoes",
  "shoes--sub-football-ag": "/shop/shoes?sub=football-ag&group=shoes",
  "shoes--sub-football-sg": "/shop/shoes?sub=football-sg&group=shoes",
  "shoes--sub-futsal": "/shop/shoes?sub=futsal&group=shoes",
  "shoes--sub-turf": "/shop/shoes?sub=turf&group=shoes",
  "shoes--sub-boots": "/shop/shoes?sub=boots&group=shoes",
  "shoes--sub-running-shoes": "/shop/shoes?sub=running-shoes&group=shoes",
  "shoes--sub-trail-running": "/shop/shoes?sub=trail-running&group=shoes",
  "shoes--sub-training-shoes": "/shop/shoes?sub=training-shoes&group=shoes",
  "shoes--sub-basketball-shoes": "/shop/shoes?sub=basketball-shoes&group=shoes",
  "shoes--sub-tennis-shoes": "/shop/shoes?sub=tennis-shoes&group=shoes",
  "shoes--sub-padel-shoes": "/shop/shoes?sub=padel-shoes&group=shoes",
  "shoes--sub-pickleball-shoes": "/shop/shoes?sub=pickleball-shoes&group=shoes",
  "shoes--sub-handball-shoes": "/shop/shoes?sub=handball-shoes&group=shoes",
  "shoes--sub-volleyball-shoes": "/shop/shoes?sub=volleyball-shoes&group=shoes",
  "shoes--sub-hockey-shoes": "/shop/shoes?sub=hockey-shoes&group=shoes",
  "shoes--sub-outdoor-shoes": "/shop/shoes?sub=outdoor-shoes&group=shoes",
  "shoes--sub-sneakers": "/shop/shoes?sub=sneakers&group=shoes",
  "shoes--sub-sandals": "/shop/shoes?sub=sandals&group=shoes",
  "shoes--sub-barefoot": "/shop/shoes?sub=barefoot&group=shoes",
  "shoes--sub-comfort-shoes": "/shop/shoes?sub=comfort-shoes&group=shoes",
  "shoes--sub-summer-shoes": "/shop/shoes?sub=summer-shoes&group=shoes",
  "shoes--sub-kids-shoes": "/shop/shoes?sub=kids-shoes&group=shoes",
  "shoes--sub-shoes": "/shop/shoes?sub=shoes",
  "balls-bags--sub-balls": "/shop/balls-bags?sub=balls&group=equipment",
  "balls-bags--sub-bags": "/shop/balls-bags?sub=bags&group=equipment",
  "balls-bags--sub-rackets": "/shop/balls-bags?sub=rackets&group=equipment",
  "balls-bags--sub-socks": "/shop/balls-bags?sub=socks&group=accessories",
};

/**
 * Fixed hub--leaf paths. Built from category slugs, audience slugs, type folder
 * keys, series children, and SUB_LINK_TARGETS. Nothing here is read from a
 * feed row, a query, or a request.
 * These ids are not added to feedTargetTable(), so a small catalog does not
 * have to emit every one.
 */
export function namespacedFeedTargets(): ReadonlyMap<string, string> {
  if (namespacedTargets) return namespacedTargets;
  const map = new Map<string, string>();
  const staticIds = feedTargetTable();
  const add = (id: string, href: string) => {
    if (!NAMESPACED_FEED_KEY.test(id)) return;
    if (staticIds.has(id)) throw new Error(`Namespaced feed id collides with a fixed id: ${id}`);
    const previous = map.get(id);
    if (previous && previous !== href) throw new Error(`Namespaced feed id ${id} has two targets`);
    if (!previous) map.set(id, href);
  };
  for (const category of CATEGORIES) {
    const hub = category.slug;
    for (const audience of AUDIENCES) {
      add(`${hub}--${audience.slug}`, `/shop/${hub}?audience=${audience.slug}`);
    }
    for (const typeKey of Object.keys(TYPE_FOLDERS)) {
      add(`${hub}--${typeKey}`, `/shop/${hub}?group=${encodeURIComponent(typeKey)}`);
    }
    const root = sportSeriesRoot(hub);
    if (!root) continue;
    for (const child of jomaFolderByKey(root)?.children ?? []) {
      const leaf = publicFolderKey(child.key);
      add(`${hub}--${leaf}`, `/shop/${hub}?group=${encodeURIComponent(leaf)}`);
    }
  }
  for (const [id, href] of Object.entries(SUB_LINK_TARGETS)) {
    if (map.has(id) || staticIds.has(id)) {
      throw new Error(`Sub link id collides with another target: ${id}`);
    }
    add(id, href);
    if (map.get(id) !== href) throw new Error(`Sub link target was not stored: ${id}`);
  }
  namespacedTargets = map;
  return map;
}

/** Static table first, then the namespaced literal map. */
export function feedTargetFor(id: string): string | null {
  return feedTargetTable().get(id) ?? namespacedFeedTargets().get(id) ?? null;
}

/** Static paths plus namespaced literals. The only paths the feed may copy. */
export function feedAllowedTargets(): ReadonlySet<string> {
  const allowed = new Set<string>(feedTargetSet());
  for (const href of namespacedFeedTargets().values()) allowed.add(href);
  return allowed;
}
