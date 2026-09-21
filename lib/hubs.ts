import {
  firstImagedProduct,
  isStorefrontFootwear,
  sampleForCategory,
  sampleFromList,
} from "@/lib/classify";
import {
  AUDIENCES,
  CAMPAIGN_COLLECTIONS,
  SUBCATEGORY_LABELS,
  categoryBySlug,
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
  men: "/brand/audience-men.png?v=2",
  women: "/brand/audience-women.png?v=3",
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
  sportswear: "/brand/hub-sportswear.png?v=4",
  shoes: "/brand/hub-shoes.png",
  lifestyle: "/brand/hub-lifestyle.png?v=3",
  "teampro-2026": "/brand/hub-teampro-2026.png",
  rugby: "/brand/hub-rugby.png?v=1",
};

function audienceSample(items: Product[], slug: AudienceSlug) {
  const preferred = items.filter((p) =>
    ["sportswear", "shoes", "running-fitness", "football", "rugby"].includes(p.category),
  );
  const pool = preferred.length ? preferred : items;
  const hub = slug === "kids" ? "shoes" : slug === "men" || slug === "women" ? undefined : undefined;
  return sampleFromList(pool, hub) ?? firstImagedProduct(pool);
}

function labeledSubcategoryGroups(
  items: Product[],
  hrefFor: (sub: string) => string,
  sampleHub?: string,
) {
  const bySub = new Map<string, Product[]>();
  for (const p of items) {
    const list = bySub.get(p.subcategory);
    if (list) list.push(p);
    else bySub.set(p.subcategory, [p]);
  }
  return [...bySub.entries()]
    .filter(([sub, list]) => list.length > 0 && Boolean(SUBCATEGORY_LABELS[sub]))
    .map(([sub, list]) => ({
      key: sub,
      name: SUBCATEGORY_LABELS[sub],
      count: list.length,
      href: hrefFor(sub),
      sample: sampleFromList(list, sampleHub) ?? firstImagedProduct(list),
    }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

export function subcategoryHubGroups(hubSlug: string, catalog: Product[] = bundled) {
  return labeledSubcategoryGroups(
    productsByCategory(hubSlug, catalog),
    (sub) => `/shop/${hubSlug}?sub=${encodeURIComponent(sub)}`,
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
  return labeledSubcategoryGroups(
    items,
    (sub) =>
      hubSlug
        ? `/shop/${hubSlug}?audience=${audience}&sub=${encodeURIComponent(sub)}`
        : `/shop/${audience}?sub=${encodeURIComponent(sub)}`,
    hubSlug,
  );
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
