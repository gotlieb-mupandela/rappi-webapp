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
  matchesTypeFolder,
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
  APPAREL_FOLDERS,
  FOOTWEAR_FOLDERS,
  KIDS_APPAREL_FOLDERS,
  KIDS_FOOTWEAR_FOLDERS,
  folderMatchesProduct,
  hasJomaFolderIndex,
  jomaFolderByKey,
  jomaFolderHasChildren,
  productsInJomaFolder,
  type JomaFolderDef,
} from "@/lib/joma-tree";
export { isKidsProduct, isKidsShoe, matchesAudience, productAudience };
/** Folder tile used on category hubs and shop folder landings. */
export type HubFolderTile = {
  key: string;
  name: string;
  count: number;
  href: string;
  sample?: Product | null;
  banner?: string;
  cover?: string;
  /** When set, HubTile should use groupName i18n instead of subName. */
  nameGroup?: {
    kind: "shoes" | "kids" | "rugby" | "brama" | "footwear" | "apparel";
    key: string;
  };
};
function footwearOnly(list: Product[]) {
  return list.filter(isStorefrontFootwear);
}
function tilesFromJomaFolders(
  folders: readonly JomaFolderDef[],
  pool: Product[],
  hrefFor: (folder: JomaFolderDef) => string,
  kind: "footwear" | "apparel" | "kids",
  sampleHub?: string,
  opts?: { includeEmpty?: boolean },
): HubFolderTile[] {
  const includeEmpty = opts?.includeEmpty ?? true;
  const groupKind = kind === "kids" ? ("kids" as const) : kind;
  const poolSet = hasJomaFolderIndex() ? new Set(pool) : null;
  return folders
    .map((folder) => {
      const items = poolSet
        ? productsInJomaFolder(folder.key).filter((p) => poolSet.has(p))
        : pool.filter((p) => folderMatchesProduct(folder, p));
      return {
        key: folder.key,
        name: folder.label,
        count: items.length,
        href: hrefFor(folder),
        sample:
          sampleForTypeFolder(
            items,
            folder.sub && (TYPE_FOLDERS.shoes as readonly string[]).includes(folder.sub)
              ? "shoes"
              : folder.key,
            sampleHub,
          ) ?? firstImagedProduct(items),
        cover: folder.cover,
        nameGroup: { kind: groupKind, key: folder.key },
      } satisfies HubFolderTile;
    })
    .filter((g) => includeEmpty || g.count > 0);
}
export function shoeHubGroups(catalog: Product[] = bundled): HubFolderTile[] {
  const shoes = footwearOnly(productsByCategory("shoes", catalog));
  const adult = shoes.filter((p) => !isKidsShoe(p));
  return tilesFromJomaFolders(
    FOOTWEAR_FOLDERS,
    adult,
    (folder) => {
      if (folder.children?.length) {
        return `/shop/shoes?group=${encodeURIComponent(folder.key)}`;
      }
      if (folder.sub) return `/shop/shoes?sub=${encodeURIComponent(folder.sub)}`;
      return `/shop/shoes?group=${encodeURIComponent(folder.key)}`;
    },
    "footwear",
    "shoes",
    { includeEmpty: true },
  );
}
export function kidsFootwearHubGroups(catalog: Product[] = bundled): HubFolderTile[] {
  const kidsShoes = footwearOnly(productsByCategory("shoes", catalog)).filter(isKidsShoe);
  return tilesFromJomaFolders(
    KIDS_FOOTWEAR_FOLDERS,
    kidsShoes,
    (folder) => {
      if (folder.sub) {
        return `/shop/shoes?audience=kids&sub=${encodeURIComponent(folder.sub)}`;
      }
      return `/shop/shoes?audience=kids&group=${encodeURIComponent(folder.key)}`;
    },
    "footwear",
    "shoes",
    { includeEmpty: true },
  );
}
export function kidsHubGroups(catalog: Product[] = bundled): HubFolderTile[] {
  const kidsApparel = catalog.filter(isKidsProduct);
  const ageTiles = tilesFromJomaFolders(
    KIDS_APPAREL_FOLDERS,
    kidsApparel,
    (folder) => `/shop/kids?group=${encodeURIComponent(folder.key)}`,
    "kids",
    undefined,
    { includeEmpty: true },
  );
  const kidsShoes = footwearOnly(productsByCategory("shoes", catalog)).filter(isKidsShoe);
  return [
    ...ageTiles,
    {
      key: "kids-footwear",
      name: "Footwear",
      count: kidsShoes.length,
      href: "/shop/shoes?audience=kids",
      sample: sampleFromList(kidsShoes, "shoes") ?? firstImagedProduct(kidsShoes),
      cover: "/brand/hub-shoes.png",
      nameGroup: { kind: "kids" as const, key: "kids-footwear" },
    },
  ];
}
export function rugbyHubGroups(catalog: Product[] = bundled): HubFolderTile[] {
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
      cover: "/brand/hub-rugby.png?v=1",
      nameGroup: { kind: "rugby" as const, key: "jerseys" },
    },
    {
      key: "shorts",
      name: "Shorts",
      count: shorts.length,
      href: "/shop/rugby?sub=shorts",
      sample: sampleFromList(shorts, "rugby"),
      nameGroup: { kind: "rugby" as const, key: "shorts" },
    },
    {
      key: "protection",
      name: "Protection",
      count: protection.length,
      href: "/shop/rugby?sub=protection",
      sample: sampleFromList(protection, "rugby"),
      nameGroup: { kind: "rugby" as const, key: "protection" },
    },
    {
      key: "balls",
      name: "Balls",
      count: balls.length,
      href: "/shop/rugby?sub=balls",
      sample: sampleFromList(balls, "rugby"),
      nameGroup: { kind: "rugby" as const, key: "balls" },
    },
  ].filter((g) => g.count > 0);
}
export function bramaHubGroups(catalog: Product[] = bundled): HubFolderTile[] {
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
      nameGroup: { kind: "brama" as const, key: "skins" },
    },
    {
      key: "tights",
      name: "Tights",
      count: tights.length,
      href: "/shop/brama?sub=tights",
      sample: sampleFromList(tights, "brama") ?? firstImagedProduct(tights),
      nameGroup: { kind: "brama" as const, key: "tights" },
    },
    {
      key: "shorts",
      name: "Short tights",
      count: shorts.length,
      href: "/shop/brama?sub=shorts",
      sample: sampleFromList(shorts, "brama") ?? firstImagedProduct(shorts),
      nameGroup: { kind: "brama" as const, key: "shorts" },
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
/**
 * Vision-aligned hub covers:
 * - hub-shoes.png → running footwear (Shoes / Running)
 * - hub-lifestyle.png → football boots (Football — not lifestyle)
 * - hero-athlete.png → rugby/teamwear prop (not Running)
 * - hub-sportswear.png → training apparel
 * - hub-teampro-2026.png → team kits
 * - hub-rugby.png → rugby tracksuit
 * - hub-kids.png → kids tracksuit
 */
export const HUB_COVERS: Partial<Record<string, string>> = {
  sportswear: "/brand/hub-sportswear.png?v=5",
  shoes: "/brand/hub-shoes.png",
  football: "/brand/hub-lifestyle.png?v=1",
  // lifestyle: no matching brand plate — use product samples
  "teampro-2026": "/brand/hub-teampro-2026.png",
  rugby: "/brand/hub-rugby.png?v=1",
  "running-fitness": "/brand/hub-shoes.png",
  kids: "/brand/hub-kids.png",
};
function audienceSample(items: Product[], slug: AudienceSlug) {
  const preferred = items.filter((p) =>
    ["sportswear", "shoes", "running-fitness", "football", "rugby"].includes(p.category),
  );
  const pool = preferred.length ? preferred : items;
  return sampleFromList(pool, slug === "kids" ? "shoes" : undefined) ?? firstImagedProduct(pool);
}
function folderQueryParam(key: string) {
  return TYPE_FOLDERS[key] || jomaFolderHasChildren(key) || jomaFolderByKey(key)
    ? "group"
    : "sub";
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
  if (
    folderKey === "shoes" ||
    folderKey.includes("running") ||
    folderKey.includes("futsal") ||
    folderKey.includes("turf") ||
    folderKey.includes("football") ||
    folderKey.includes("trail") ||
    folderKey.includes("sneaker") ||
    folderKey.includes("sandal") ||
    folderKey.includes("barefoot")
  ) {
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
export function subcategoryHubGroups(hubSlug: string, catalog: Product[] = bundled): HubFolderTile[] {
  return labeledSubcategoryGroups(
    productsByCategory(hubSlug, catalog),
    (key) => `/shop/${hubSlug}?${folderQueryParam(key)}=${encodeURIComponent(key)}`,
    hubSlug,
  );
}
/**
 * Child tiles for a nested Joma folder (e.g. Football → surface types, Teamwear → sports).
 */
export function jomaChildFolderGroups(
  groupKey: string,
  catalog: Product[] = bundled,
  opts?: { categorySlug?: string; audience?: AudienceSlug },
): HubFolderTile[] {
  const parent = jomaFolderByKey(groupKey);
  if (!parent?.children?.length) return [];
  const hubSlug = opts?.categorySlug;
  const audience = opts?.audience;
  let pool = hubSlug ? productsByCategory(hubSlug, catalog) : catalog;
  if (audience) pool = pool.filter((p) => matchesAudience(p, audience));
  const footwearParent =
    FOOTWEAR_FOLDERS.some((f) => f.key === groupKey) ||
    parent.children.some(
      (c) => c.sub && (TYPE_FOLDERS.shoes as readonly string[]).includes(c.sub),
    );
  if (footwearParent || hubSlug === "shoes") {
    pool = pool.filter(isStorefrontFootwear);
  } else {
    pool = pool.filter((p) => !isStorefrontFootwear(p));
  }
  const kind: "footwear" | "apparel" = footwearParent ? "footwear" : "apparel";
  return tilesFromJomaFolders(
    parent.children,
    pool,
    (folder) => {
      const params = new URLSearchParams();
      if (audience && hubSlug) params.set("audience", audience);
      params.set("group", groupKey);
      if (folder.sub) params.set("sub", folder.sub);
      else params.set("group", folder.key);
      const base = hubSlug
        ? `/shop/${hubSlug}`
        : audience
          ? `/shop/${audience}`
          : "/shop/sportswear";
      if (folder.sub) {
        const p = new URLSearchParams();
        if (audience) p.set("audience", audience);
        if (parent.children) p.set("group", groupKey);
        p.set("sub", folder.sub);
        return `${base}?${p.toString()}`;
      }
      const p = new URLSearchParams();
      if (audience) p.set("audience", audience);
      p.set("group", folder.key);
      return `${base}?${p.toString()}`;
    },
    kind,
    hubSlug,
    { includeEmpty: true },
  );
}
/**
 * Top-level folder tiles for a category shop landing.
 * Shoes → PDF Footwear tree; brama/rugby curated; sportswear → PDF apparel mid folders.
 */
export function categoryHubFolders(hubSlug: string, catalog: Product[] = bundled): HubFolderTile[] {
  if (hubSlug === "shoes") return shoeHubGroups(catalog);
  if (hubSlug === "brama") return bramaHubGroups(catalog);
  if (hubSlug === "rugby") return rugbyHubGroups(catalog);
  if (hubSlug === "sportswear") {
    const items = productsByCategory(hubSlug, catalog).filter((p) => !isStorefrontFootwear(p));
    return tilesFromJomaFolders(
      APPAREL_FOLDERS,
      items,
      (folder) =>
        folder.children?.length
          ? `/shop/sportswear?group=${encodeURIComponent(folder.key)}`
          : `/shop/sportswear?group=${encodeURIComponent(folder.key)}`,
      "apparel",
      "sportswear",
      { includeEmpty: true },
    );
  }
  return subcategoryHubGroups(hubSlug, catalog);
}
/**
 * Leaf subcategory folders inside a TYPE_FOLDER (e.g. Men → Shirts → Tees / Polos / Jerseys).
 * Returns [] when the group is not a type folder or has fewer than 2 labeled leaves.
 */
export function typeFolderLeafGroups(
  groupKey: string,
  catalog: Product[] = bundled,
  opts?: { categorySlug?: string; audience?: AudienceSlug },
): HubFolderTile[] {
  if (!TYPE_FOLDERS[groupKey]) return [];
  const hubSlug = opts?.categorySlug;
  const audience = opts?.audience;
  let items = hubSlug ? productsByCategory(hubSlug, catalog) : catalog;
  if (audience) items = items.filter((p) => matchesAudience(p, audience));
  items = items.filter((p) => matchesTypeFolder(p.subcategory, groupKey));
  const bySub = new Map<string, Product[]>();
  for (const p of items) {
    if (!SUBCATEGORY_LABELS[p.subcategory] || HIDDEN_TYPE_FOLDERS.has(p.subcategory)) continue;
    const list = bySub.get(p.subcategory);
    if (list) list.push(p);
    else bySub.set(p.subcategory, [p]);
  }
  const leaves = [...bySub.entries()]
    .filter(([, list]) => list.length > 0)
    .map(([key, list]) => {
      const params = new URLSearchParams();
      if (hubSlug && audience) params.set("audience", audience);
      params.set("group", groupKey);
      params.set("sub", key);
      const base = hubSlug
        ? `/shop/${hubSlug}`
        : audience
          ? `/shop/${audience}`
          : "/shop/sportswear";
      return {
        key,
        name: SUBCATEGORY_LABELS[key] ?? key,
        count: list.length,
        href: `${base}?${params.toString()}`,
        sample: sampleForTypeFolder(list, groupKey, hubSlug) ?? firstImagedProduct(list),
      } satisfies HubFolderTile;
    })
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  return leaves.length >= 2 ? leaves : [];
}
export function audienceHubGroups(
  audience: AudienceSlug,
  catalog: Product[] = bundled,
  opts?: { categorySlug?: string },
): HubFolderTile[] {
  const hubSlug = opts?.categorySlug;
  const scoped = hubSlug ? productsByCategory(hubSlug, catalog) : catalog;
  const items = scoped.filter((p) => matchesAudience(p, audience));
  if (hubSlug === "shoes") {
    const shoes = footwearOnly(items);
    const folders = audience === "kids" ? KIDS_FOOTWEAR_FOLDERS : FOOTWEAR_FOLDERS;
    return tilesFromJomaFolders(
      folders,
      shoes,
      (folder) => {
        const params = new URLSearchParams();
        params.set("audience", audience);
        if (folder.children?.length) {
          params.set("group", folder.key);
        } else if (folder.sub) {
          params.set("sub", folder.sub);
        } else {
          params.set("group", folder.key);
        }
        return `/shop/shoes?${params.toString()}`;
      },
      "footwear",
      "shoes",
      { includeEmpty: true },
    );
  }
  if (audience === "kids" && !hubSlug) {
    return kidsHubGroups(catalog);
  }
  if (!hubSlug) {
    const apparelPool = items.filter((p) => !isStorefrontFootwear(p));
    return tilesFromJomaFolders(
      APPAREL_FOLDERS,
      apparelPool,
      (folder) => {
        if (folder.children?.length) {
          return `/shop/${audience}?group=${encodeURIComponent(folder.key)}`;
        }
        return `/shop/${audience}?group=${encodeURIComponent(folder.key)}`;
      },
      "apparel",
      undefined,
      { includeEmpty: true },
    );
  }
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
export function audienceTiles(
  catalog: Product[] = bundled,
  opts?: { categorySlug?: string },
) {
  const scoped = opts?.categorySlug
    ? productsByCategory(opts.categorySlug, catalog)
    : catalog;
  const buckets: Record<AudienceSlug, Product[]> = {
    men: [],
    women: [],
    kids: [],
  };
  for (const p of scoped) {
    if (matchesAudience(p, "kids")) buckets.kids.push(p);
    else if (matchesAudience(p, "women")) buckets.women.push(p);
    else if (matchesAudience(p, "men")) buckets.men.push(p);
  }
  return AUDIENCES.map((a) => {
    const items = buckets[a.slug];
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
