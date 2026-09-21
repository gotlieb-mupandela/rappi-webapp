import { matchesAudience, productAudience } from "@/lib/audience";
import { AUDIENCES, CATEGORIES, SUBCATEGORY_LABELS, matchesTypeFolder } from "@/lib/catalog";
import { hasUsableProductImage } from "@/lib/classify";
import {
  LISTING_PAGE_SIZE,
  type ListingFacet,
  type ListingFilterOpts,
  type ListingItem,
  type ListingQuery,
  type ListingResult,
} from "@/lib/listing-types";
import type { Product } from "@/lib/types";

export { LISTING_PAGE_SIZE } from "@/lib/listing-types";
export type {
  ListingFacet,
  ListingFilterOpts,
  ListingItem,
  ListingQuery,
  ListingResult,
} from "@/lib/listing-types";

const CATEGORY_NAME_BY_SLUG: Record<string, string> = Object.fromEntries(
  CATEGORIES.map((c) => [c.slug, c.name.toLowerCase()]),
);

export function listingHubs(product: Pick<ListingItem, "category" | "hubs">): string[] {
  const extra = product.hubs ?? [];
  const out = [product.category];
  for (const h of extra) {
    if (h && h !== product.category && !out.includes(h)) out.push(h);
  }
  return out;
}

export function listingInHub(product: Pick<ListingItem, "category" | "hubs">, slug: string) {
  return product.category === slug || Boolean(product.hubs?.includes(slug));
}

export function listingHay(product: ListingItem): string {
  if (product.hay) return product.hay;
  const sub = (SUBCATEGORY_LABELS[product.subcategory] ?? product.subcategory).toLowerCase();
  return `${product.code} ${product.item} ${product.name} ${product.title} ${product.description ?? ""} ${CATEGORY_NAME_BY_SLUG[product.category] ?? ""} ${sub} ${product.category}`.toLowerCase();
}

export function parseListingQuery(sp: ListingQuery): ListingQuery {
  return {
    q: (sp.q ?? "").trim(),
    cat: sp.cat || undefined,
    sub: sp.sub || undefined,
    group: sp.group || undefined,
    size: sp.size || undefined,
    max: sp.max || undefined,
    audience: sp.audience || undefined,
    page: sp.page,
  };
}

export function listingQueryFromSearchParams(sp: URLSearchParams): ListingQuery {
  return parseListingQuery({
    q: sp.get("q") ?? undefined,
    cat: sp.get("cat") ?? undefined,
    sub: sp.get("sub") ?? undefined,
    group: sp.get("group") ?? undefined,
    size: sp.get("size") ?? undefined,
    max: sp.get("max") ?? undefined,
    audience: sp.get("audience") ?? undefined,
    page: sp.get("page") ?? undefined,
  });
}

export function listingHref(basePath: string, query: ListingQuery, categorySlug?: string) {
  const next = new URLSearchParams();
  const q = (query.q ?? "").trim();
  if (q) next.set("q", q);
  if (query.cat && query.cat !== "all" && query.cat !== categorySlug) next.set("cat", query.cat);
  if (query.sub && query.sub !== "all") next.set("sub", query.sub);
  if (query.group && query.group !== "all") next.set("group", query.group);
  if (query.size && query.size !== "all") next.set("size", query.size);
  if (query.max) next.set("max", query.max);
  if (query.audience && query.audience !== "all") next.set("audience", query.audience);
  const page = Number(query.page ?? 1);
  if (Number.isFinite(page) && page > 1) next.set("page", String(page));
  const qs = next.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

export function listingQueryIsActive(
  query: ListingQuery,
  opts?: { categorySlug?: string; audienceSlug?: string },
) {
  const q = (query.q ?? "").trim();
  if (q) return true;
  if (query.cat && query.cat !== "all" && query.cat !== opts?.categorySlug) return true;
  if (query.sub && query.sub !== "all") return true;
  if (query.group && query.group !== "all") return true;
  if (query.size && query.size !== "all") return true;
  if (query.max) return true;
  if (query.audience && query.audience !== "all" && query.audience !== opts?.audienceSlug) {
    return true;
  }
  const page = Number(query.page ?? 1);
  return Number.isFinite(page) && page > 1;
}

export function searchListing(
  catalog: ListingItem[],
  query: string,
  category?: string,
): ListingItem[] {
  const q = query.trim().toLowerCase();
  let list = catalog.filter((p) => hasUsableProductImage(p as Product));
  if (category && category !== "all") {
    list = list.filter((p) => listingInHub(p, category));
  }
  if (!q) return list;
  return list.filter((p) => listingHay(p).includes(q));
}

export function filterListing(
  catalog: ListingItem[],
  query: ListingQuery,
  opts?: ListingFilterOpts,
): ListingItem[] {
  const q = (query.q ?? "").trim();
  if (opts?.requireQuery && !q) return [];

  const scopedCat = opts?.categorySlug || query.cat;
  let list = q ? searchListing(catalog, q, scopedCat) : catalog.filter((p) => hasUsableProductImage(p as Product));
  if (!q && scopedCat && scopedCat !== "all") {
    list = list.filter((p) => listingInHub(p, scopedCat));
  }
  if (opts?.badges?.length) {
    const badges = new Set(opts.badges);
    list = list.filter((p) => p.badge != null && badges.has(p.badge));
  }

  const sub = query.sub && query.sub !== "all" ? query.sub : "";
  const group = query.group && query.group !== "all" ? query.group : "";
  const size = query.size && query.size !== "all" ? query.size : "";
  const audience = query.audience && query.audience !== "all" ? query.audience : "";
  const max = query.max ? Number(query.max) : NaN;

  return list.filter((p) => {
    if (sub && p.subcategory !== sub) return false;
    if (group && !matchesTypeFolder(p.subcategory, group)) return false;
    if (audience && !matchesAudience(p, audience)) return false;
    if (size && !p.sizes.some((s) => s.size === size && s.stock > 0)) return false;
    if (Number.isFinite(max) && p.price > max) return false;
    return true;
  });
}

function facetCategories(list: ListingItem[]): ListingFacet[] {
  const counts = new Map<string, number>();
  for (const p of list) {
    for (const hub of listingHubs(p)) counts.set(hub, (counts.get(hub) ?? 0) + 1);
  }
  return CATEGORIES.map((c) => ({
    slug: c.slug,
    name: c.name,
    count: counts.get(c.slug) ?? 0,
  })).filter((c) => c.count > 0);
}

function facetAudiences(list: ListingItem[]): ListingFacet[] {
  const counts = new Map<string, number>();
  for (const p of list) {
    const audience = p.audience ?? productAudience(p);
    if (audience === "unisex") continue;
    counts.set(audience, (counts.get(audience) ?? 0) + 1);
  }
  return AUDIENCES.map((a) => ({
    slug: a.slug,
    name: a.name,
    count: counts.get(a.slug) ?? 0,
  })).filter((a) => a.count > 0);
}

function facetSubs(list: ListingItem[]): ListingFacet[] {
  const counts = new Map<string, number>();
  for (const p of list) counts.set(p.subcategory, (counts.get(p.subcategory) ?? 0) + 1);
  return [...counts.entries()]
    .map(([slug, count]) => ({
      slug,
      name: SUBCATEGORY_LABELS[slug] ?? slug,
      count,
    }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

function facetSizes(list: ListingItem[]): string[] {
  const set = new Set<string>();
  for (const p of list) {
    p.sizes.forEach((s) => {
      if (!/^(ONE|SKU|PACK)$/i.test(s.size) && s.stock > 0) set.add(s.size);
    });
  }
  const order = ["XS", "S", "M", "L", "XL", "2XL", "3XL", "4XL", "ONE"];
  return [...set].sort((a, b) => {
    const ia = order.indexOf(a.toUpperCase());
    const ib = order.indexOf(b.toUpperCase());
    if (ia !== -1 && ib !== -1) return ia - ib;
    if (ia !== -1) return -1;
    if (ib !== -1) return 1;
    return a.localeCompare(b, undefined, { numeric: true });
  });
}

export function paginateListing(
  list: ListingItem[],
  query: ListingQuery,
  pageSize = LISTING_PAGE_SIZE,
): ListingResult {
  const rawPage = Number(query.page ?? 1);
  const pageCount = Math.max(1, Math.ceil(list.length / pageSize));
  const page = Number.isFinite(rawPage)
    ? Math.min(Math.max(1, Math.floor(rawPage)), pageCount)
    : 1;
  const start = (page - 1) * pageSize;
  return {
    products: list.slice(start, start + pageSize),
    total: list.length,
    page,
    pageSize,
    pageCount,
    query: (query.q ?? "").trim(),
    facets: {
      categories: facetCategories(list),
      audiences: facetAudiences(list),
      subs: facetSubs(list),
      sizes: facetSizes(list),
    },
  };
}

export function buildListing(
  catalog: ListingItem[],
  query: ListingQuery,
  opts?: ListingFilterOpts,
): ListingResult {
  const audience = query.audience && query.audience !== "all" ? query.audience : "";
  const beforeAudience = audience
    ? filterListing(catalog, { ...query, audience: undefined }, opts)
    : null;
  const filtered = beforeAudience
    ? beforeAudience.filter((p) => matchesAudience(p, audience))
    : filterListing(catalog, query, opts);
  const result = paginateListing(filtered, query, opts?.pageSize ?? LISTING_PAGE_SIZE);
  if (beforeAudience) result.facets.audiences = facetAudiences(beforeAudience);
  return result;
}
