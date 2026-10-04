"use client";

import { useEffect, useLayoutEffect, useState, type ReactNode } from "react";
import { CatalogFilters } from "@/components/catalog-filters";
import { useT } from "@/components/locale-provider";
import { audienceName, hubName } from "@/lib/i18n/labels";
import {
  listingQueryFromSearchParams,
  listingQueryIsActive,
  type ListingQuery,
  type ListingResult,
} from "@/lib/listing-core";

function queryFromLocation(): ListingQuery {
  if (typeof window === "undefined") return {};
  return listingQueryFromSearchParams(new URLSearchParams(window.location.search));
}

function apiParams(query: ListingQuery, categorySlug?: string, audienceSlug?: string) {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  const cat = categorySlug || query.cat;
  if (cat && cat !== "all") params.set("cat", cat);
  if (query.sub) params.set("sub", query.sub);
  if (query.group) params.set("group", query.group);
  if (query.size) params.set("size", query.size);
  if (query.max) params.set("max", query.max);
  const audience = audienceSlug || query.audience;
  if (audience && audience !== "all") params.set("audience", audience);
  if (query.page && Number(query.page) > 1) params.set("page", String(query.page));
  params.sort();
  return params.toString();
}

async function fetchListing(url: string, requireQuery: boolean): Promise<ListingResult> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`listing ${res.status}`);
  const data = await res.json();
  if (requireQuery) return data.listing as ListingResult;
  return {
    products: data.products,
    total: data.total,
    page: data.page,
    pageSize: data.pageSize,
    pageCount: data.pageCount,
    query: "",
    facets: data.facets,
  } as ListingResult;
}

const listingCache = new Map<string, ListingResult>();

export function CatalogBrowser({
  basePath,
  categorySlug,
  audienceSlug,
  requireQuery = false,
  grouped = true,
  showCategoryFilter = false,
  showAudienceFilter = true,
  showLayoutToggle,
  hideFilters = false,
  emptyTitle,
  emptyBody,
  emptyTitleKey,
  emptyBodyKey,
  emptyQuiet = false,
  emptyKind,
  emptySlug,
  emptyQuery,
  initialListing,
}: {
  basePath: string;
  categorySlug?: string;
  audienceSlug?: string;
  requireQuery?: boolean;
  grouped?: boolean;
  showCategoryFilter?: boolean;
  showAudienceFilter?: boolean;
  showLayoutToggle?: boolean;
  hideFilters?: boolean;
  emptyTitle?: string;
  emptyBody?: string;
  emptyTitleKey?: string;
  emptyBodyKey?: string;
  emptyQuiet?: boolean;
  emptyKind?: "audience" | "hub";
  emptySlug?: string;
  emptyQuery?: ReactNode;
  initialListing?: ListingResult;
}) {
  const t = useT();
  const [query, setQuery] = useState<ListingQuery>({});
  const [ready, setReady] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [remote, setRemote] = useState<ListingResult | null>(null);

  useLayoutEffect(() => {
    setQuery(queryFromLocation());
    setReady(true);
  }, []);

  useEffect(() => {
    const onPop = () => {
      setQuery(queryFromLocation());
      setDirty(true);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const hasQ = Boolean((query.q ?? "").trim());
  const useInitial =
    !requireQuery &&
    Boolean(initialListing) &&
    !dirty &&
    !listingQueryIsActive(query, { categorySlug, audienceSlug });
  const params = apiParams(query, categorySlug, audienceSlug);
  const endpoint = requireQuery ? "/api/search" : "/api/catalog";
  const url = `${endpoint}?${params}`;
  const shouldFetch = ready && !useInitial && (!requireQuery || hasQ);

  useEffect(() => {
    if (!shouldFetch) return;
    const hit = listingCache.get(url);
    if (hit) {
      setRemote(hit);
      return;
    }
    let alive = true;
    fetchListing(url, requireQuery)
      .then((result) => {
        listingCache.set(url, result);
        if (alive) setRemote(result);
      })
      .catch(() => {
        if (alive && initialListing) setRemote(initialListing);
      });
    return () => {
      alive = false;
    };
  }, [shouldFetch, url, requireQuery, initialListing]);

  function onNavigate(href: string) {
    const next = new URL(href, window.location.origin);
    window.history.pushState(null, "", `${next.pathname}${next.search}`);
    setQuery(listingQueryFromSearchParams(next.searchParams));
    setDirty(true);
  }

  if (requireQuery && ready && !hasQ) {
    return <>{emptyQuery}</>;
  }

  const listing = useInitial ? initialListing! : remote ?? (requireQuery ? null : initialListing ?? null);

  if (!listing) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-6 py-16 text-center">
        <p className="text-sm text-[var(--muted)]">{t("common.searching")}</p>
      </div>
    );
  }

  return (
    <CatalogFilters
      listing={listing}
      query={query}
      categorySlug={categorySlug}
      basePath={basePath}
      grouped={grouped}
      showCategoryFilter={showCategoryFilter}
      showAudienceFilter={showAudienceFilter}
      showLayoutToggle={showLayoutToggle}
      hideFilters={hideFilters}
      emptyTitle={
        emptyTitleKey
          ? t(emptyTitleKey, {
              name:
                emptyKind === "audience" && emptySlug
                  ? audienceName(emptySlug, t).toLowerCase()
                  : emptyKind === "hub" && emptySlug
                    ? hubName(emptySlug, t).toLowerCase()
                    : "",
            })
          : emptyTitle
      }
      emptyBody={emptyBodyKey ? t(emptyBodyKey) : emptyBody}
      emptyQuiet={emptyQuiet}
      onNavigate={onNavigate}
    />
  );
}
