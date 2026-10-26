import type { ListingQuery } from "@/lib/listing-types";

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
