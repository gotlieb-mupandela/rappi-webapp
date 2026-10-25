import { destinations } from "@/lib/joma-nav-links";
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

const men = destinations("men");
const women = destinations("women");

export const HOME_TILES: readonly FeedTargetTile[] = [
  { id: "teamwear", label: "Teamwear", href: "/teamwear", image: TEAM_COVER },
  { id: "sportswear", label: "Sportswear", href: "/category/sportswear", image: SPORT_COVER },
  { id: "running", label: "Running", href: "/category/running-fitness", image: SHOE_COVER },
  { id: "lifestyle", label: "Lifestyle", href: "/category/lifestyle", image: SPORT_COVER },
  { id: "footwear", label: "Footwear", href: "/category/shoes", image: SHOE_COVER },
  { id: "kids", label: "Kids", href: "/shop/kids", image: SPORT_COVER },
];

export const MEN_TILES: readonly FeedTargetTile[] = [
  { id: "men-teamwear", label: "Teamwear", href: men.teamwear, image: MEN_COVER, folderKey: "teamwear" },
  { id: "men-teamwear-pro", label: "Teamwear Pro 2026", href: men.teamwearPro, image: MEN_COVER, folderKey: "teamwear-pro-2026" },
  { id: "men-running", label: "Running / Trail", href: men.running, image: MEN_COVER, folderKey: "running-trail" },
  { id: "men-cycling", label: "Cycling", href: men.cycling, image: MEN_COVER, folderKey: "cycling" },
  { id: "men-racket", label: "Racket sports", href: men.racket, image: MEN_COVER, folderKey: "racket-sports" },
  { id: "men-hiking", label: "Hiking / Outdoor", href: men.hiking, image: MEN_COVER, folderKey: "hiking-outdoor" },
  { id: "men-fitness", label: "Fitness / Gym", href: men.fitness, image: MEN_COVER, folderKey: "fitness-gym" },
  { id: "men-lifestyle", label: "Lifestyle", href: men.lifestyle, image: MEN_COVER, folderKey: "lifestyle-apparel" },
  { id: "men-resort", label: "Resort", href: men.resort, image: MEN_COVER, folderKey: "resort" },
  { id: "men-aguila", label: "Águila Line", href: men.aguila, image: MEN_COVER, folderKey: "aguila-line" },
  { id: "men-beachwear", label: "Beachwear", href: men.beachwear, image: MEN_COVER, folderKey: "beachwear" },
  { id: "men-brama", label: "Underwear / Brama", href: men.brama, image: MEN_COVER, folderKey: "underwear-brama" },
  { id: "men-combat", label: "Athletes / Combat", href: men.combat, image: MEN_COVER, folderKey: "athletes-combat" },
  { id: "men-elite", label: "Elite club", href: men.elite, image: MEN_COVER, folderKey: "elite-club" },
];

export const WOMEN_TILES: readonly FeedTargetTile[] = [
  { id: "women-teamwear", label: "Teamwear", href: women.teamwear, image: WOMEN_COVER, folderKey: "teamwear-woman" },
  { id: "women-teamwear-pro", label: "Teamwear Pro 2026", href: women.teamwearPro, image: WOMEN_COVER, folderKey: "w-teamwear-pro-2026" },
  { id: "women-running", label: "Running / Trail", href: women.running, image: WOMEN_COVER, folderKey: "running-trail-woman" },
  { id: "women-cycling", label: "Cycling", href: women.cycling, image: WOMEN_COVER, folderKey: "w-cycling" },
  { id: "women-racket", label: "Racket sports", href: women.racket, image: WOMEN_COVER, folderKey: "racket-sports-woman" },
  { id: "women-hiking", label: "Hiking / Outdoor", href: women.hiking, image: WOMEN_COVER, folderKey: "w-hiking-outdoor" },
  { id: "women-fitness", label: "Fitness / Gym", href: women.fitness, image: WOMEN_COVER, folderKey: "fitness-gym-woman" },
  { id: "women-lifestyle", label: "Lifestyle", href: women.lifestyle, image: WOMEN_COVER, folderKey: "lifestyle-apparel-woman" },
  { id: "women-resort", label: "Resort", href: women.resort, image: WOMEN_COVER, folderKey: "w-resort" },
  { id: "women-aguila", label: "Águila Line", href: women.aguila, image: WOMEN_COVER, folderKey: "w-aguila-line" },
  { id: "women-beachwear", label: "Beachwear", href: women.beachwear, image: WOMEN_COVER, folderKey: "w-beachwear" },
  { id: "women-brama", label: "Underwear / Brama", href: women.brama, image: WOMEN_COVER, folderKey: "underwear-brama-woman" },
  { id: "women-combat", label: "Athletes / Combat", href: women.combat, image: WOMEN_COVER, folderKey: "w-athletes-combat" },
  { id: "women-elite", label: "Elite club", href: women.elite, image: WOMEN_COVER, folderKey: "w-elite-club" },
];

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

export const ACCESSORY_TILES: readonly FeedTargetTile[] = [
  { id: "acc-balls", label: "Balls", href: "/shop/balls-bags?group=acc-balls", image: SPORT_COVER, folderKey: "acc-balls" },
  { id: "acc-backpacks", label: "Backpacks", href: "/shop/balls-bags?group=acc-backpacks", image: SPORT_COVER, folderKey: "acc-backpacks" },
  { id: "acc-socks", label: "Socks", href: "/shop/sportswear?group=acc-socks", image: SPORT_COVER, folderKey: "acc-socks" },
];

export const KIT_TILES: readonly FeedTargetTile[] = [
  {
    id: "kits-federations",
    label: "Federations",
    href: "/teamwear?view=kits&group=kits-federations",
    image: TEAM_COVER,
    folderKey: "kits-federations",
  },
  {
    id: "kits-special",
    label: "Special editions",
    href: "/teamwear?view=kits&group=kits-special",
    image: TEAM_COVER,
    folderKey: "kits-special",
  },
];

/** Outlet and price-band tiles. Href strings are fixed literals, not catalogue text. */
export const PROMO_TILES: readonly FeedTargetTile[] = [
  { id: "outlet-promotions", label: "Promotions", href: "/promotions?group=outlet-promotions", image: SPORT_COVER, folderKey: "outlet-promotions" },
  { id: "outlet-footwear", label: "Footwear", href: "/shop/shoes?group=outlet-footwear", image: SHOE_COVER, folderKey: "outlet-footwear" },
  { id: "outlet-apparel-byear", label: "Apparel by year", href: "/promotions?group=outlet-apparel-byear", image: SPORT_COVER, folderKey: "outlet-apparel-byear" },
  { id: "outlet-sweatshirt-jacket", label: "Sweatshirt / Jacket", href: "/promotions?group=outlet-sweatshirt-jacket", image: SPORT_COVER, folderKey: "outlet-sweatshirt-jacket" },
  { id: "outlet-tshirt-top", label: "T-shirt / Top", href: "/promotions?group=outlet-tshirt-top", image: SPORT_COVER, folderKey: "outlet-tshirt-top" },
  { id: "outlet-pants-shorts", label: "Pants / Shorts", href: "/promotions?group=outlet-pants-shorts", image: SPORT_COVER, folderKey: "outlet-pants-shorts" },
  { id: "outlet-anorak", label: "Anorak", href: "/promotions?group=outlet-anorak", image: SPORT_COVER, folderKey: "outlet-anorak" },
  { id: "outlet-tracksuit", label: "Tracksuit", href: "/promotions?group=outlet-tracksuit", image: SPORT_COVER, folderKey: "outlet-tracksuit" },
  { id: "outlet-junior", label: "Junior", href: "/promotions?group=outlet-junior", image: SPORT_COVER, folderKey: "outlet-junior" },
  { id: "outlet-price-199-299", label: "1.99 - 2.99", href: "/promotions?group=outlet-price-199-299", image: SPORT_COVER, folderKey: "outlet-price-199-299" },
  { id: "outlet-price-299-399", label: "2.99 - 3.99", href: "/promotions?group=outlet-price-299-399", image: SPORT_COVER, folderKey: "outlet-price-299-399" },
  { id: "outlet-price-399-499", label: "3.99 - 4.99", href: "/promotions?group=outlet-price-399-499", image: SPORT_COVER, folderKey: "outlet-price-399-499" },
  { id: "outlet-price-499-599", label: "4.99 - 5.99", href: "/promotions?group=outlet-price-499-599", image: SPORT_COVER, folderKey: "outlet-price-499-599" },
  { id: "outlet-price-599-699", label: "5.99 - 6.99", href: "/promotions?group=outlet-price-599-699", image: SPORT_COVER, folderKey: "outlet-price-599-699" },
  { id: "outlet-price-699-799", label: "6.99 - 7.99", href: "/promotions?group=outlet-price-699-799", image: SPORT_COVER, folderKey: "outlet-price-699-799" },
  { id: "outlet-price-799-1099", label: "7.99 - 10.99", href: "/promotions?group=outlet-price-799-1099", image: SPORT_COVER, folderKey: "outlet-price-799-1099" },
  { id: "outlet-price-1099-1599", label: "10.99 - 15.99", href: "/promotions?group=outlet-price-1099-1599", image: SPORT_COVER, folderKey: "outlet-price-1099-1599" },
  { id: "outlet-price-from-1599", label: "From 15.99", href: "/promotions?group=outlet-price-from-1599", image: SPORT_COVER, folderKey: "outlet-price-from-1599" },
];

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

function constantHrefs(): string[] {
  const tiles = [
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
  return [...FEED_MENUS.map((menu) => menu.href), ...tiles.map((tile) => tile.href)];
}

let targets: Set<string> | null = null;

/** Every href the feed is allowed to emit. Built from this module, not from a request. */
export function feedTargetSet(): ReadonlySet<string> {
  if (targets) return targets;
  const set = new Set<string>(constantHrefs());
  for (const href of folderHrefEntries().values()) set.add(href);
  targets = set;
  return set;
}
