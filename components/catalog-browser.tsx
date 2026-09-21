"use client";

import { useEffect, useLayoutEffect, useMemo, useState, type ReactNode } from "react";
import { CatalogFilters } from "@/components/catalog-filters";
import { useT } from "@/components/locale-provider";
import { audienceName, hubName } from "@/lib/i18n/labels";
import {
  buildListing,
  listingQueryFromSearchParams,
  listingQueryIsActive,
  type ListingFilterOpts,
  type ListingItem,
  type ListingQuery,
  type ListingResult,
} from "@/lib/listing-core";
import { getListingIndexSync, loadListingIndex } from "@/lib/listing-index";

function queryFromLocation(): ListingQuery {
  if (typeof window === "undefined") return {};
  return listingQueryFromSearchParams(new URLSearchParams(window.location.search));
}

export function CatalogBrowser({
  basePath,
  categorySlug,
  audienceSlug,
  requireQuery = false,
  badges,
  grouped = true,
  showCategoryFilter = false,
  showAudienceFilter = true,
  showLayoutToggle,
  emptyTitle,
  emptyBody,
  emptyTitleKey,
  emptyBodyKey,
  emptyKind,
  emptySlug,
  emptyQuery,
  initialListing,
}: {
  basePath: string;
  categorySlug?: string;
  audienceSlug?: string;
  requireQuery?: boolean;
  badges?: ListingFilterOpts["badges"];
  grouped?: boolean;
  showCategoryFilter?: boolean;
  showAudienceFilter?: boolean;
  showLayoutToggle?: boolean;
  emptyTitle?: string;
  emptyBody?: string;
  emptyTitleKey?: string;
  emptyBodyKey?: string;
  emptyKind?: "audience" | "hub";
  emptySlug?: string;
  emptyQuery?: ReactNode;
  initialListing?: ListingResult;
}) {
  const t = useT();
  const [index, setIndex] = useState<ListingItem[] | null>(getListingIndexSync);
  const [query, setQuery] = useState<ListingQuery>({});

  useLayoutEffect(() => {
    setQuery(queryFromLocation());
  }, []);

  useEffect(() => {
    let alive = true;
    loadListingIndex()
      .then((rows) => {
        if (alive) setIndex(rows);
      })
      .catch(() => {
        /* Keep SSR initial listing when the index fails to load. */
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const onPop = () => setQuery(queryFromLocation());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const listingQuery: ListingQuery = audienceSlug
    ? { ...query, audience: audienceSlug }
    : query;
  const filterOpts: ListingFilterOpts = {
    categorySlug,
    requireQuery,
    badges,
  };

  const listing = useMemo(() => {
    if (index) return buildListing(index, listingQuery, filterOpts);
    const canUseInitial =
      initialListing &&
      !requireQuery &&
      !listingQueryIsActive(query, { categorySlug, audienceSlug });
    return canUseInitial ? initialListing : null;
  }, [
    index,
    listingQuery.q,
    listingQuery.cat,
    listingQuery.sub,
    listingQuery.group,
    listingQuery.size,
    listingQuery.max,
    listingQuery.audience,
    listingQuery.page,
    categorySlug,
    requireQuery,
    badges,
    initialListing,
    query,
    audienceSlug,
  ]);

  function onNavigate(href: string) {
    const url = new URL(href, window.location.origin);
    window.history.pushState(null, "", `${url.pathname}${url.search}`);
    setQuery(listingQueryFromSearchParams(url.searchParams));
  }

  if (requireQuery && !(query.q ?? "").trim()) {
    return <>{emptyQuery}</>;
  }

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
      onNavigate={onNavigate}
    />
  );
}
