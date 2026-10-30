import {
  AUDIENCE_COVERS,
  HUB_COVERS,
  accessoriesLandingTiles,
  audienceLandingTiles,
  footwearLandingTiles,
  kidsLandingTiles,
  outletLandingTiles,
  teamsLandingTiles,
} from "@/lib/hubs";
import type { Product } from "@/lib/types";

/**
 * Menu tile pictures read from the same landing-tile builders the site pages
 * render (app/shop/[slug], app/teamwear, app/promotions), with the same catalog.
 * The feed copies these onto its menu tile nodes, so a picture change on the
 * site reaches the app without a second table to maintain.
 */

export type SiteTile = { label: string; href?: string; imageSrc?: string };

const AUDIENCE_LABEL_KEYS: Record<"men" | "women", Record<string, string>> = {
  men: {
    TEAMWEAR: "teamwear",
    "TEAMWEAR PRO 2026": "teamwear-pro-2026",
    "RUNNING / TRAILRUNNING": "running-trail",
    CYCLING: "cycling",
    "RACKET SPORTS": "racket-sports",
    "HIKING / OUTDOOR": "hiking-outdoor",
    "FITNESS / GYM": "fitness-gym",
    LIFESTYLE: "lifestyle-apparel",
    "ÁGUILA LINE": "aguila-line",
    "AGUILA LINE": "aguila-line",
    RESORT: "resort",
    BEACHWEAR: "beachwear",
    "UNDERWEAR / BRAMA": "underwear-brama",
    "ATHLETES / COMBAT": "athletes-combat",
    "ELITE CLUB": "elite-club",
  },
  women: {
    TEAMWEAR: "teamwear",
    "TEAMWEAR PRO 2026": "teamwear-pro-2026",
    "RUNNING / TRAILRUNNING": "running-trail-woman",
    CYCLING: "cycling",
    "RACKET SPORTS": "racket-sports-woman",
    "HIKING / OUTDOOR": "hiking-outdoor",
    "FITNESS / GYM": "fitness-gym-woman",
    LIFESTYLE: "lifestyle-apparel-woman",
    "ÁGUILA LINE": "aguila-line",
    "AGUILA LINE": "aguila-line",
    RESORT: "resort",
    BEACHWEAR: "beachwear",
    "UNDERWEAR / BRAMA": "underwear-brama-woman",
    "ATHLETES / COMBAT": "athletes-combat",
    "ELITE CLUB": "elite-club",
  },
};

const TEAM_SEARCH_KEYS: Record<string, string> = {
  polyester: "polyester",
  cotton: "cotton",
  volley: "volleyball",
  handball: "handball",
  staff: "coach",
  referee: "referee",
  goalkeeper: "goalie",
};

const PATH_KEYS: Record<string, string> = {
  "/shop/football": "football",
  "/shop/basketball": "basketball",
  "/shop/rugby": "rugby",
  "/shop/cricket": "cricket",
  "/shop/swimming": "swimming",
  "/teamwear": "teamwear",
};

function labelKey(label: string) {
  return label
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Feed tile id for a site landing tile. Undefined when the tile has no feed node. */
export function siteTileKey(href: string | undefined, label: string, menu: string): string | undefined {
  if (href) {
    try {
      const url = new URL(href, "https://rappi.local");
      const group = url.searchParams.get("group");
      if (group) return group;
      if (menu === "shoes") {
        const audience = url.searchParams.get("audience");
        if (audience) return `shoes-${audience}`;
      }
      const age = url.searchParams.get("age");
      if (age === "1-4") return "kids-1-4";
      if (age === "6-10") return "kids-6-10";
      if (age === "12-14") {
        return url.searchParams.get("gender") === "girl" ? "kids-12-14-girl" : "kids-12-14-boy";
      }
      const q = url.searchParams.get("q");
      if (q && TEAM_SEARCH_KEYS[q]) return TEAM_SEARCH_KEYS[q];
      if (PATH_KEYS[url.pathname]) return PATH_KEYS[url.pathname];
    } catch {
      /* use the label map */
    }
  }
  if (menu === "men" || menu === "women") return AUDIENCE_LABEL_KEYS[menu][labelKey(label)];
  return undefined;
}

/** The landing tiles a site page renders for one header menu, same catalog argument as the page. */
export function siteMenuTiles(menuId: string, catalog: Product[]): SiteTile[] {
  switch (menuId) {
    case "men":
    case "women":
      return audienceLandingTiles(menuId, catalog);
    case "kids":
      return kidsLandingTiles(catalog);
    case "shoes":
      return footwearLandingTiles(catalog);
    case "teams":
      return teamsLandingTiles(catalog);
    case "accessories":
      return accessoriesLandingTiles(catalog);
    case "outlet":
      return outletLandingTiles(catalog);
    default:
      return [];
  }
}

/**
 * Feed tile ids in the order the site landing page shows them. Empty when the
 * menu has no landing page builder (kits), so the caller keeps its own list.
 */
export function siteMenuTileKeys(menuId: string, catalog: Product[]): string[] {
  const keys: string[] = [];
  for (const tile of siteMenuTiles(menuId, catalog)) {
    const key = siteTileKey(tile.href, tile.label, menuId);
    if (key && !keys.includes(key)) keys.push(key);
  }
  return keys;
}

/**
 * Feed tile id to the picture the site tile shows. Tiles with no picture are
 * left out so the caller keeps its own default. The first site tile wins when
 * two map to one id.
 */
export function siteMenuPictures(menuId: string, catalog: Product[]): Map<string, string> {
  const pictures = new Map<string, string>();
  for (const tile of siteMenuTiles(menuId, catalog)) {
    if (!tile.imageSrc) continue;
    const key = siteTileKey(tile.href, tile.label, menuId);
    if (key && !pictures.has(key)) pictures.set(key, tile.imageSrc);
  }
  return pictures;
}

/**
 * Cover for a header menu. The site header has no pictures, so this is the
 * rule the first storefront endpoint used: brand covers for men, women,
 * footwear, teams and kits; the home kids photo for children; the first
 * landing tile picture for accessories and outlet.
 */
export function siteMenuCover(
  menuId: string,
  pictures: ReadonlyMap<string, string>,
  homeKidsPicture: string | null,
): string | null {
  switch (menuId) {
    case "men":
      return AUDIENCE_COVERS.men ?? null;
    case "women":
      return AUDIENCE_COVERS.women ?? null;
    case "kids":
      return homeKidsPicture ?? firstPicture(pictures);
    case "shoes":
      return HUB_COVERS.shoes ?? null;
    case "teams":
    case "kits":
      return HUB_COVERS["teampro-2026"] ?? null;
    case "accessories":
    case "outlet":
      return firstPicture(pictures);
    default:
      return null;
  }
}

function firstPicture(pictures: ReadonlyMap<string, string>): string | null {
  for (const url of pictures.values()) if (url) return url;
  return null;
}
