import {
  firstImagedProduct,
  isStorefrontFootwear,
  sampleForCategory,
  sampleFromList,
} from "@/lib/classify";
import {
  AUDIENCES,
  CAMPAIGN_COLLECTIONS,
  HIDDEN_TYPE_FOLDERS,
  SUBCATEGORY_LABELS,
  TYPE_FOLDER_ORDER,
  TYPE_FOLDERS,
  WOMEN_CODED_TYPE_FOLDERS,
  categoryBySlug,
  typeFolderForSubcategory,
  type AudienceSlug,
} from "@/lib/catalog";
import type { Product } from "@/lib/types";
import { products as bundled, productsByCategory } from "@/lib/products";
import {
  isKidsProduct,
  isKidsShoe,
  matchesAudience,
  productAudience,
} from "@/lib/audience";
import {
  jomaAccessoriesLandingTiles,
  jomaAudienceLandingTiles,
  jomaFootwearLandingTiles,
  jomaKidsLandingTiles,
  jomaOfficialKitsLandingTiles,
  jomaOutletLandingTiles,
  type AccessoriesLandingTileDef,
} from "@/lib/joma-nav";
import { productCardImageUrl } from "@/lib/media";
import { productInHub } from "@/lib/hub-membership";

export { isKidsProduct, isKidsShoe, matchesAudience, productAudience };

function footwearOnly(list: Product[]) {
  return list.filter(isStorefrontFootwear);
}

export function shoeHubGroups(catalog: Product[] = bundled) {
  const shoes = footwearOnly(productsByCategory("shoes", catalog));
  const running = shoes.filter(
    (p) => p.subcategory === "running-shoes" || p.subcategory === "training-shoes",
  );
  const kids = shoes.filter((p) => isKidsShoe(p) && p.subcategory !== "running-shoes");
  const sandals = shoes.filter((p) => p.subcategory === "sandals" || p.subcategory === "barefoot");
  const boots = shoes.filter((p) => p.subcategory === "boots");
  const adult = shoes.filter(
    (p) =>
      !isKidsShoe(p) &&
      p.subcategory !== "running-shoes" &&
      p.subcategory !== "training-shoes" &&
      p.subcategory !== "sandals" &&
      p.subcategory !== "barefoot" &&
      p.subcategory !== "boots",
  );
  const offers = shoes.filter((p) => p.badge === "offer" || p.badge === "new");
  return [
    {
      key: "adult",
      name: "Sneakers",
      count: adult.length,
      href: "/shop/shoes?sub=sneakers",
      sample: sampleFromList(adult, "shoes") ?? firstImagedProduct(adult),
    },
    {
      key: "boots",
      name: "Boots",
      count: boots.length,
      href: "/shop/shoes?sub=boots",
      sample: sampleFromList(boots, "shoes") ?? firstImagedProduct(boots),
    },
    {
      key: "kids",
      name: "Kids",
      count: kids.length,
      href: "/shop/shoes?audience=kids",
      sample: sampleFromList(kids, "shoes") ?? firstImagedProduct(kids),
    },
    {
      key: "running",
      name: "Running",
      count: running.length,
      href: "/shop/shoes?sub=running-shoes",
      sample: sampleFromList(running, "shoes") ?? firstImagedProduct(running),
    },
    {
      key: "sandals",
      name: "Sandals & barefoot",
      count: sandals.length,
      href: "/shop/shoes?sub=sandals",
      sample: sampleFromList(sandals, "shoes") ?? firstImagedProduct(sandals),
    },
    {
      key: "offers",
      name: "Outlet",
      count: offers.length || shoes.length,
      href: "/promotions",
      sample: sampleFromList(offers.length ? offers : shoes, "shoes"),
      banner: "Special offers",
    },
  ].filter((g) => g.count > 0);
}

export function kidsHubGroups(catalog: Product[] = bundled) {
  const kidsApparel = catalog.filter(isKidsProduct);
  const tees = kidsApparel.filter(
    (p) =>
      p.subcategory === "tees-kids" ||
      p.item === "KIDS" ||
      (p.subcategory === "tees" && /\b(junior| jr\b|kids)\b/.test(p.displayName.toLowerCase())),
  );
  const shorts = kidsApparel.filter(
    (p) => p.item === "SHORTS KIDS" || p.subcategory === "shorts",
  );
  const jackets = kidsApparel.filter(
    (p) => p.subcategory === "jackets-kids" || p.subcategory === "jackets",
  );
  const kidsShoes = footwearOnly(productsByCategory("shoes", catalog)).filter(isKidsShoe);
  return [
    {
      key: "tees",
      name: "Kids tees",
      count: tees.length,
      href: "/shop/sportswear?sub=tees-kids",
      sample: firstImagedProduct(tees),
    },
    {
      key: "shorts",
      name: "Kids shorts",
      count: shorts.length,
      href: "/shop/sportswear?sub=shorts",
      sample: firstImagedProduct(shorts),
    },
    {
      key: "jackets",
      name: "Kids jackets",
      count: jackets.length,
      href: "/shop/sportswear?sub=jackets",
      sample: firstImagedProduct(jackets),
    },
    {
      key: "shoes",
      name: "Kids shoes",
      count: kidsShoes.length,
      href: "/shop/shoes?audience=kids",
      sample: sampleFromList(kidsShoes, "shoes") ?? firstImagedProduct(kidsShoes),
    },
  ].filter((g) => g.count > 0);
}

export function rugbyHubGroups(catalog: Product[] = bundled) {
  const items = productsByCategory("rugby", catalog);
  const of = (sub: string) => items.filter((p) => p.subcategory === sub);
  const jerseys = of("jerseys");
  const shorts = of("shorts");
  const protection = of("protection");
  const balls = of("balls");
  return [
    {
      key: "jerseys",
      name: "Jerseys",
      count: jerseys.length,
      href: "/shop/rugby?sub=jerseys",
      sample: sampleFromList(jerseys, "rugby"),
    },
    {
      key: "shorts",
      name: "Shorts",
      count: shorts.length,
      href: "/shop/rugby?sub=shorts",
      sample: sampleFromList(shorts, "rugby"),
    },
    {
      key: "protection",
      name: "Protection",
      count: protection.length,
      href: "/shop/rugby?sub=protection",
      sample: sampleFromList(protection, "rugby"),
    },
    {
      key: "balls",
      name: "Balls",
      count: balls.length,
      href: "/shop/rugby?sub=balls",
      sample: sampleFromList(balls, "rugby"),
    },
  ].filter((g) => g.count > 0);
}

export function bramaHubGroups(catalog: Product[] = bundled) {
  const items = productsByCategory("brama", catalog);
  const skins = items.filter((p) => p.subcategory === "skins");
  const tights = items.filter((p) => p.subcategory === "tights");
  const shorts = items.filter((p) => p.subcategory === "shorts");
  return [
    {
      key: "skins",
      name: "Skins",
      count: skins.length,
      href: "/shop/brama?sub=skins",
      sample: sampleFromList(skins, "brama") ?? firstImagedProduct(skins),
    },
    {
      key: "tights",
      name: "Tights",
      count: tights.length,
      href: "/shop/brama?sub=tights",
      sample: sampleFromList(tights, "brama") ?? firstImagedProduct(tights),
    },
    {
      key: "shorts",
      name: "Short tights",
      count: shorts.length,
      href: "/shop/brama?sub=shorts",
      sample: sampleFromList(shorts, "brama") ?? firstImagedProduct(shorts),
    },
  ].filter((g) => g.count > 0);
}

/** Local lifestyle covers for homepage / hub audience tiles. */
export const AUDIENCE_COVERS: Partial<Record<AudienceSlug, string>> = {
  men: "/brand/audience-men.png?v=3",
  women: "/brand/audience-women.png?v=4",
  kids: "/brand/hub-kids.png",
};

export const HOME_SPORTS = [
  "rugby",
  "football",
  "running-fitness",
  "basketball",
  "padel",
  "swimming",
  "cricket",
  "hockey",
  "boxing",
  "hiking",
  "netball",
] as const;

export const HOME_CATEGORY_HUBS = ["shoes", "balls-bags", "lifestyle"] as const;

/** Local lifestyle covers for homepage SHOP hub tiles (by category slug). */
export const HUB_COVERS: Partial<Record<string, string>> = {
  sportswear: "/brand/hub-sportswear.png?v=5",
  shoes: "/brand/hub-shoes.png",
  lifestyle: "/brand/hub-lifestyle.png?v=4",
  "teampro-2026": "/brand/hub-teampro-2026.png",
  rugby: "/brand/hub-rugby.png?v=1",
  "running-fitness": "/brand/hero-athlete.png?v=2",
  kids: "/brand/hub-kids.png",
};

function audienceSample(items: Product[], slug: AudienceSlug) {
  const preferred = items.filter((p) =>
    ["sportswear", "shoes", "running-fitness", "football", "rugby"].includes(p.category),
  );
  const pool = preferred.length ? preferred : items;
  const hub = slug === "kids" ? "shoes" : slug === "men" || slug === "women" ? undefined : undefined;
  return sampleFromList(pool, hub) ?? firstImagedProduct(pool);
}

function folderQueryParam(key: string) {
  return TYPE_FOLDERS[key] ? "group" : "sub";
}

const FOLDER_LOOK: Partial<Record<string, RegExp>> = {
  shirts: /\b(t-?shirt|tee|polo|jersey|shirt|top)\b/,
  jackets: /\b(jacket|hoodie|sweatshirt|anorak|raincoat|soft shell|parka)\b/,
  shorts: /\b(short|bermuda)\b/,
  pants: /\b(pant|trouser|tight|legging|tracksuit|sweatpant)\b/,
  equipment: /\b(ball|bag|racket|backpack|paddle)\b/,
};

function looksLikeFolder(product: Product, folderKey: string) {
  const re = FOLDER_LOOK[folderKey];
  if (!re) return true;
  return re.test(`${product.displayName} ${product.item} ${product.name}`.toLowerCase());
}

/** Folder-tile photo only — do not reuse for hub/homepage footwear heroes. */
function sampleForTypeFolder(list: Product[], folderKey: string, sampleHub?: string) {
  const footwear = list.filter(isStorefrontFootwear);
  const apparel = list.filter((p) => !isStorefrontFootwear(p));
  if (folderKey === "shoes") {
    const pool = footwear.length ? footwear : list;
    return sampleFromList(pool, "shoes") ?? firstImagedProduct(pool);
  }
  const base = apparel.length ? apparel : list;
  const look = base.filter((p) => looksLikeFolder(p, folderKey));
  const pool = look.length ? look : base;
  return firstImagedProduct(pool) ?? sampleFromList(pool, sampleHub);
}

function labeledSubcategoryGroups(
  items: Product[],
  hrefFor: (key: string) => string,
  sampleHub?: string,
) {
  const byFolder = new Map<string, Product[]>();
  for (const p of items) {
    if (!SUBCATEGORY_LABELS[p.subcategory] && !isStorefrontFootwear(p)) continue;
    const folder = isStorefrontFootwear(p)
      ? "shoes"
      : typeFolderForSubcategory(p.subcategory);
    if (HIDDEN_TYPE_FOLDERS.has(folder)) continue;
    if (
      !(TYPE_FOLDER_ORDER as readonly string[]).includes(folder) &&
      !TYPE_FOLDERS[folder]
    ) {
      continue;
    }
    const list = byFolder.get(folder);
    if (list) list.push(p);
    else byFolder.set(folder, [p]);
  }
  return [...byFolder.entries()]
    .filter(([key, list]) => list.length > 0 && !HIDDEN_TYPE_FOLDERS.has(key))
    .map(([key, list]) => ({
      key,
      name: SUBCATEGORY_LABELS[key] ?? SUBCATEGORY_LABELS[list[0]?.subcategory] ?? key,
      count: list.length,
      href: hrefFor(key),
      sample: sampleForTypeFolder(list, key, sampleHub),
    }))
    .sort((a, b) => {
      const ia = TYPE_FOLDER_ORDER.indexOf(a.key as (typeof TYPE_FOLDER_ORDER)[number]);
      const ib = TYPE_FOLDER_ORDER.indexOf(b.key as (typeof TYPE_FOLDER_ORDER)[number]);
      const ra = ia === -1 ? TYPE_FOLDER_ORDER.length : ia;
      const rb = ib === -1 ? TYPE_FOLDER_ORDER.length : ib;
      return ra - rb || a.name.localeCompare(b.name);
    });
}

export function subcategoryHubGroups(hubSlug: string, catalog: Product[] = bundled) {
  return labeledSubcategoryGroups(
    productsByCategory(hubSlug, catalog),
    (key) => `/shop/${hubSlug}?${folderQueryParam(key)}=${encodeURIComponent(key)}`,
    hubSlug,
  );
}

export function audienceHubGroups(
  audience: AudienceSlug,
  catalog: Product[] = bundled,
  opts?: { categorySlug?: string },
) {
  const hubSlug = opts?.categorySlug;
  const scoped = hubSlug ? productsByCategory(hubSlug, catalog) : catalog;
  const items = scoped.filter((p) => matchesAudience(p, audience));
  const groups = labeledSubcategoryGroups(
    items,
    (key) => {
      const param = `${folderQueryParam(key)}=${encodeURIComponent(key)}`;
      return hubSlug
        ? `/shop/${hubSlug}?audience=${audience}&${param}`
        : `/shop/${audience}?${param}`;
    },
    hubSlug,
  );
  if (audience === "men") {
    return groups.filter((g) => !WOMEN_CODED_TYPE_FOLDERS.has(g.key));
  }
  return groups;
}

/** Resolve a non-blank cover for a Joma audience landing tile. */
function landingTileImage(
  hub: string,
  cover: string | undefined,
  audience: "men" | "women",
  catalog: Product[],
) {
  if (cover) return cover;
  const scoped = catalog.filter(
    (p) => productInHub(p, hub) && matchesAudience(p, audience),
  );
  const sample =
    sampleFromList(scoped, hub) ??
    sampleForCategory(catalog, hub) ??
    firstImagedProduct(scoped);
  if (sample) {
    const url = productCardImageUrl(sample);
    if (url) return url;
  }
  return (
    HUB_COVERS[hub] ??
    AUDIENCE_COVERS[audience] ??
    HUB_COVERS.sportswear ??
    "/brand/hub-sportswear.png?v=5"
  );
}

/** Resolve a non-blank cover for a Children landing tile. */
function kidsLandingTileImage(
  hub: string,
  cover: string | undefined,
  catalog: Product[],
  index: number,
) {
  if (cover) return cover;
  const kids = catalog.filter((p) => isKidsProduct(p) && productInHub(p, hub));
  const pool = kids.length ? kids : catalog.filter(isKidsProduct);
  const imaged = pool.filter((p) => Boolean(productCardImageUrl(p)));
  const sample =
    imaged[index % Math.max(imaged.length, 1)] ??
    sampleFromList(pool, hub) ??
    firstImagedProduct(pool);
  if (sample) {
    const url = productCardImageUrl(sample);
    if (url) return url;
  }
  return (
    HUB_COVERS[hub] ??
    AUDIENCE_COVERS.kids ??
    HUB_COVERS.kids ??
    "/brand/hub-kids.png"
  );
}

/** Man / Woman first-view tiles: image + uppercase label, Joma B2B order. */
export function audienceLandingTiles(
  audience: "men" | "women",
  catalog: Product[] = bundled,
) {
  return jomaAudienceLandingTiles(audience).map((tile) => ({
    label: tile.label,
    href: tile.href,
    imageSrc: landingTileImage(tile.hub, tile.cover, audience, catalog),
  }));
}

/** Prefer an audience-scoped footwear photo; fall back to any shoes / hub cover. */
function footwearLandingImage(
  audience: "men" | "women" | "kids" | undefined,
  catalog: Product[],
  preferOffers = false,
) {
  const shoes = footwearOnly(productsByCategory("shoes", catalog));
  const fallback = HUB_COVERS.shoes ?? "/brand/hub-shoes.png";
  if (!shoes.length) return fallback;

  let pool = shoes;
  if (preferOffers) {
    const offers = shoes.filter((p) => p.badge === "offer" || p.badge === "new");
    if (offers.length) pool = offers;
  } else if (audience === "kids") {
    const kids = shoes.filter((p) => matchesAudience(p, "kids") || isKidsShoe(p));
    if (kids.length) pool = kids;
  } else if (audience) {
    const scoped = shoes.filter((p) => matchesAudience(p, audience));
    if (scoped.length) pool = scoped;
  }

  const sample = sampleFromList(pool, "shoes") ?? firstImagedProduct(pool);
  if (sample) {
    const url = productCardImageUrl(sample);
    if (url) return url;
  }
  return fallback;
}

/** Footwear first-view tiles: Man / Woman / Junior / Outlet. */
export function footwearLandingTiles(catalog: Product[] = bundled) {
  return jomaFootwearLandingTiles().map((tile) => ({
    label: tile.label,
    href: tile.href,
    imageSrc: footwearLandingImage(tile.audience, catalog, tile.label === "OUTLET"),
    banner: tile.banner,
  }));
}

/** Children first-view tiles: 4 age/gender destinations matching header dropdown. */
export function kidsLandingTiles(catalog: Product[] = bundled) {
  return jomaKidsLandingTiles().map((tile, index) => ({
    label: tile.label,
    href: tile.href,
    imageSrc: kidsLandingTileImage(tile.hub, tile.cover, catalog, index),
  }));
}

/** Official Kits hub: 3 portrait tiles matching header dropdown. */
export function officialKitsLandingTiles(catalog: Product[] = bundled) {
  return jomaOfficialKitsLandingTiles().map((tile) => ({
    label: tile.label,
    href: tile.href,
    imageSrc:
      tile.cover ??
      landingTileImage(tile.hub, undefined, "men", catalog),
  }));
}

/** Outlet hub: photo promos + orange category cards + red price cards. */
export function outletLandingTiles(catalog: Product[] = bundled) {
  return jomaOutletLandingTiles().map((tile, index) => {
    let imageSrc = "";
    if (tile.kind === "photo") {
      if (tile.hub === "shoes") {
        imageSrc = footwearLandingImage(
          undefined,
          catalog,
          tile.label === "FOOTWEAR" || tile.label === "PROMOTIONS",
        );
      } else if (tile.hub) {
        imageSrc = landingTileImage(tile.hub, undefined, "men", catalog);
      }
      if (!imageSrc) {
        imageSrc = HUB_COVERS.shoes ?? "/brand/hub-shoes.png";
      }
    }
    return {
      label: tile.label,
      href: tile.href,
      imageSrc,
      banner: tile.banner,
      bannerTone: tile.bannerTone,
      outletKind: tile.kind,
      barLabel: tile.barLabel,
      key: `${tile.label}-${index}`,
    };
  });
}

/** Prefer subcategory product photo; brand cover; hub cover; empty = gray tile. */
function accessoriesLandingTileImage(
  tile: AccessoriesLandingTileDef,
  catalog: Product[],
  index: number,
) {
  if (tile.hub) {
    let pool = catalog.filter((p) => productInHub(p, tile.hub!));
    if (tile.sub) {
      const bySub = pool.filter((p) => p.subcategory === tile.sub);
      if (bySub.length) pool = bySub;
    }
    const imaged = pool.filter((p) => Boolean(productCardImageUrl(p)));
    if (imaged.length) {
      const sample = imaged[index % imaged.length];
      const url = productCardImageUrl(sample);
      if (url) return url;
    }
    const sample =
      sampleFromList(pool, tile.hub) ??
      sampleForCategory(catalog, tile.hub) ??
      firstImagedProduct(pool);
    if (sample) {
      const url = productCardImageUrl(sample);
      if (url) return url;
    }
  }
  if (tile.cover) return tile.cover;
  if (tile.hub) return HUB_COVERS[tile.hub] ?? "";
  return "";
}

/** Accessories first-view tiles: dense B2B grid matching Accessories dropdown. */
export function accessoriesLandingTiles(catalog: Product[] = bundled) {
  return jomaAccessoriesLandingTiles().map((tile, index) => ({
    label: tile.label,
    href: tile.href,
    imageSrc: accessoriesLandingTileImage(tile, catalog, index),
  }));
}

export function audienceTiles(
  catalog: Product[] = bundled,
  opts?: { categorySlug?: string },
) {
  const scoped = opts?.categorySlug
    ? productsByCategory(opts.categorySlug, catalog)
    : catalog;
  return AUDIENCES.map((a) => {
    const items = scoped.filter((p) => matchesAudience(p, a.slug));
    const href = opts?.categorySlug
      ? `/shop/${opts.categorySlug}?audience=${a.slug}`
      : `/shop/${a.slug}`;
    return {
      key: a.slug,
      name: a.name,
      count: items.length,
      href,
      sample: audienceSample(items, a.slug),
      cover: AUDIENCE_COVERS[a.slug],
    };
  }).filter((g) => g.count > 0);
}

export function collectionTiles(catalog: Product[] = bundled) {
  return CAMPAIGN_COLLECTIONS.map((slug) => {
    const cat = categoryBySlug(slug);
    const items = productsByCategory(slug, catalog);
    return {
      key: slug,
      name: cat?.name ?? slug,
      href: `/category/${slug}`,
      count: items.length,
      sample: sampleForCategory(catalog, slug) ?? firstImagedProduct(items),
    };
  }).filter((g) => g.count > 0);
}
