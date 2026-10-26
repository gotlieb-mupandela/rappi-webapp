import {
  AUDIENCE_COVERS,
  HUB_COVERS,
  accessoriesLandingTiles,
  audienceLandingTiles,
  footwearLandingTiles,
  kidsLandingTiles,
  officialKitsLandingTiles,
  outletLandingTiles,
  teamsLandingTiles,
} from "@/lib/hubs";
import { applyBrandHash, brandPath } from "@/lib/image-cache";
import { productCardImageUrl } from "@/lib/media";
import { metaAbsoluteUrl, metaSiteUrl } from "@/lib/meta/site";
import { canonicalSlug } from "@/lib/slug-aliases";
import { pinnedTileImageUrl, productForPin } from "@/lib/tile-covers";

const TEAMWEAR_COVER = "/brand/hub-teampro-2026.webp";

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

type StorefrontCovers = {
  homeTiles: Record<string, string>;
  menus: Record<string, { image?: string; tiles: Record<string, string> }>;
  hubCovers: Record<string, string>;
};

function labelKey(label: string) {
  return label
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

function tileKey(href: string | undefined, label: string, menu: string): string | undefined {
  if (href) {
    try {
      const url = new URL(href, "https://www.rappisportshub.com");
      const group = url.searchParams.get("group");
      if (group) return canonicalSlug(group);
      if (menu === "shoes") {
        const audience = url.searchParams.get("audience");
        if (audience) return audience;
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

function tilesFrom(
  items: { label: string; href?: string; imageSrc?: string }[],
  menu: string,
  etags: Record<string, string>,
): Record<string, string> {
  const tiles: Record<string, string> = {};
  for (const item of items) {
    const key = tileKey(item.href, item.label, menu);
    const image = absoluteImage(item.imageSrc, etags);
    if (key && image) tiles[key] = image;
  }
  return tiles;
}

function absoluteImage(url: string | undefined, etags: Record<string, string>): string | undefined {
  if (!url) return undefined;
  return metaAbsoluteUrl(applyBrandHash(url, etags));
}

function firstTileImage(tiles: Record<string, string>): string | undefined {
  return Object.values(tiles).find(Boolean);
}

function collectBrandPaths(urls: Array<string | undefined>): string[] {
  const paths = new Set<string>();
  for (const url of urls) {
    const path = url ? brandPath(url) : undefined;
    if (path) paths.add(path);
  }
  return [...paths];
}

async function brandEtags(paths: string[]): Promise<Record<string, string>> {
  const origin = metaSiteUrl();
  const entries = await Promise.all(
    paths.map(async (path) => {
      try {
        const response = await fetch(`${origin}${path}`, { method: "HEAD", cache: "no-store" });
        const tag = (response.headers.get("etag") ?? response.headers.get("last-modified") ?? "")
          .replace(/^W\//, "")
          .replace(/[^a-zA-Z0-9]/g, "")
          .slice(0, 16);
        return tag ? ([path, tag] as const) : null;
      } catch {
        return null;
      }
    }),
  );
  return Object.fromEntries(entries.filter((entry): entry is readonly [string, string] => Boolean(entry)));
}

function homeSources() {
  const running = productForPin("home:running");
  const lifestyle = productForPin("home:lifestyle");
  const kids = productForPin("home:kids");
  return {
    teamwear: TEAMWEAR_COVER,
    sportswear: HUB_COVERS.sportswear,
    running: productCardImageUrl(running ?? { imageUrl: "", images: [] }) || HUB_COVERS["running-fitness"],
    lifestyle: productCardImageUrl(lifestyle ?? { imageUrl: "", images: [] }),
    footwear: HUB_COVERS.shoes,
    kids: pinnedTileImageUrl("home:kids") || productCardImageUrl(kids ?? { imageUrl: "", images: [] }),
  };
}

export async function buildStorefrontCovers(): Promise<StorefrontCovers> {
  const menTiles = audienceLandingTiles("men");
  const womenTiles = audienceLandingTiles("women");
  const kidsTiles = kidsLandingTiles();
  const shoeTiles = footwearLandingTiles();
  const kitTiles = officialKitsLandingTiles();
  const accessoryTiles = accessoriesLandingTiles();
  const outletTiles = outletLandingTiles();
  const teamTiles = teamsLandingTiles();
  const home = homeSources();

  const etags = await brandEtags(
    collectBrandPaths([
      ...Object.values(home),
      AUDIENCE_COVERS.men,
      AUDIENCE_COVERS.women,
      HUB_COVERS.sportswear,
      HUB_COVERS.shoes,
      HUB_COVERS["teampro-2026"],
      HUB_COVERS["running-fitness"],
      TEAMWEAR_COVER,
      ...menTiles.map((tile) => tile.imageSrc),
      ...womenTiles.map((tile) => tile.imageSrc),
      ...kidsTiles.map((tile) => tile.imageSrc),
      ...shoeTiles.map((tile) => tile.imageSrc),
      ...kitTiles.map((tile) => tile.imageSrc),
      ...accessoryTiles.map((tile) => tile.imageSrc),
      ...outletTiles.map((tile) => tile.imageSrc),
      ...teamTiles.map((tile) => tile.imageSrc),
    ]),
  );

  const men = tilesFrom(menTiles, "men", etags);
  const women = tilesFrom(womenTiles, "women", etags);
  const kids = tilesFrom(kidsTiles, "kids", etags);
  const shoes = tilesFrom(shoeTiles, "shoes", etags);
  const kits = tilesFrom(kitTiles, "kits", etags);
  const accessories = tilesFrom(accessoryTiles, "accessories", etags);
  const outlet = tilesFrom(outletTiles, "outlet", etags);
  const teamwear = tilesFrom(teamTiles, "teamwear", etags);

  const homeTiles = Object.fromEntries(
    Object.entries(home)
      .map(([key, url]) => [key, absoluteImage(url, etags)])
      .filter((entry): entry is [string, string] => Boolean(entry[1])),
  );

  return {
    homeTiles,
    menus: {
      men: { image: absoluteImage(AUDIENCE_COVERS.men, etags) ?? firstTileImage(men), tiles: men },
      women: { image: absoluteImage(AUDIENCE_COVERS.women, etags) ?? firstTileImage(women), tiles: women },
      kids: { image: homeTiles.kids ?? firstTileImage(kids), tiles: kids },
      shoes: { image: absoluteImage(HUB_COVERS.shoes, etags) ?? firstTileImage(shoes), tiles: shoes },
      kits: { image: absoluteImage(HUB_COVERS["teampro-2026"], etags) ?? firstTileImage(kits), tiles: kits },
      accessories: { image: firstTileImage(accessories), tiles: accessories },
      outlet: { image: firstTileImage(outlet), tiles: outlet },
      teamwear: { image: absoluteImage(TEAMWEAR_COVER, etags) ?? firstTileImage(teamwear), tiles: teamwear },
    },
    hubCovers: {
      sportswear: homeTiles.sportswear ?? absoluteImage(HUB_COVERS.sportswear, etags) ?? "",
      shoes: homeTiles.footwear ?? absoluteImage(HUB_COVERS.shoes, etags) ?? "",
      "running-fitness": homeTiles.running ?? absoluteImage(HUB_COVERS["running-fitness"], etags) ?? "",
      lifestyle: homeTiles.lifestyle ?? "",
      "teampro-2026": absoluteImage(HUB_COVERS["teampro-2026"], etags) ?? "",
      men: absoluteImage(AUDIENCE_COVERS.men, etags) ?? "",
      women: absoluteImage(AUDIENCE_COVERS.women, etags) ?? "",
    },
  };
}
