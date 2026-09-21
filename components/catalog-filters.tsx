"use client";

import { useEffect, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ProductGrid } from "@/components/product-grid";
import { ListingPagination } from "@/components/listing-pagination";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { listingHref, parseListingQuery } from "@/lib/listing-core";
import type { ListingQuery, ListingResult } from "@/lib/listing-types";
import { LayoutGrid, List } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLocale } from "@/components/locale-provider";
import { convertToNad, convertFromNad, currencySymbol } from "@/lib/i18n/currency";
import { audienceName, hubName, subName } from "@/lib/i18n/labels";

function asAll(value?: string) {
  return !value || value === "all" ? "all" : value;
}

export function CatalogFilters({
  listing,
  query,
  categorySlug,
  basePath,
  grouped = true,
  showCategoryFilter = false,
  showAudienceFilter = true,
  emptyTitle,
  emptyBody,
  children,
  onNavigate,
  showLayoutToggle,
}: {
  listing: ListingResult;
  query?: ListingQuery;
  categorySlug?: string;
  basePath: string;
  grouped?: boolean;
  showCategoryFilter?: boolean;
  showAudienceFilter?: boolean;
  emptyTitle?: string;
  emptyBody?: string;
  children?: ReactNode;
  onNavigate?: (href: string) => void;
  showLayoutToggle?: boolean;
}) {
  const router = useRouter();
  const { t, market } = useLocale();
  const parsed = parseListingQuery(query ?? {});
  const sub = asAll(parsed.sub);
  const group = asAll(parsed.group);
  const size = asAll(parsed.size);
  const maxPrice = parsed.max ?? "";
  const q = parsed.q ?? "";
  const cat = asAll(parsed.cat) !== "all" ? asAll(parsed.cat) : categorySlug ?? "all";
  const audience = asAll(parsed.audience);
  const [draftQ, setDraftQ] = useState(q);
  const [layout, setLayout] = useState<"grid" | "list">("grid");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const layoutToggle = showLayoutToggle ?? !children;

  useEffect(() => {
    setDraftQ(q);
  }, [q]);

  function currentQuery(overrides: Partial<ListingQuery> = {}): ListingQuery {
    return {
      q,
      cat: cat !== "all" && cat !== categorySlug ? cat : undefined,
      sub: sub !== "all" ? sub : undefined,
      group: group !== "all" ? group : undefined,
      size: size !== "all" ? size : undefined,
      max: maxPrice || undefined,
      audience: audience !== "all" ? audience : undefined,
      page: parsed.page,
      ...overrides,
    };
  }

  function hrefWith(next: ListingQuery) {
    return listingHref(basePath, next, categorySlug);
  }

  function go(href: string) {
    if (onNavigate) {
      onNavigate(href);
      return;
    }
    startTransition(() => {
      router.push(href);
    });
  }

  function setParam(key: string, value: string, resetPage = true) {
    const next = currentQuery({
      [key]: !value || value === "all" ? undefined : value,
      ...(resetPage && key !== "page" ? { page: undefined } : {}),
    });
    go(hrefWith(next));
  }

  function pageHref(page: number) {
    return hrefWith(currentQuery({ page: page <= 1 ? undefined : page }));
  }

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(13.5rem,15rem)_minmax(0,1fr)] lg:gap-8 xl:gap-10">
      <div className="lg:hidden">
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={() => setFiltersOpen((v) => !v)}
        >
          {filtersOpen ? t("filters.hide") : t("filters.filters")}
        </Button>
      </div>
      <aside
        className={cn(
          "space-y-7 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6",
          "lg:sticky lg:top-[calc(var(--header-h)+env(safe-area-inset-top)+0.75rem)] lg:max-h-[calc(100dvh-var(--header-h)-env(safe-area-inset-top)-1.5rem)] lg:overflow-y-auto lg:overscroll-contain",
          filtersOpen ? "block" : "hidden lg:block",
        )}
      >
        {showCategoryFilter ? (
          <FilterBlock title={t("filters.category")}>
            <FilterLink active={cat === "all"} onClick={() => setParam("cat", "all")}>
              {t("common.all")} ({listing.total})
            </FilterLink>
            {listing.facets.categories.map((c) => (
              <FilterLink
                key={c.slug}
                active={cat === c.slug}
                onClick={() => setParam("cat", c.slug)}
              >
                {hubName(c.slug, t)} ({c.count})
              </FilterLink>
            ))}
          </FilterBlock>
        ) : null}

        {showAudienceFilter && listing.facets.audiences.length > 0 ? (
          <FilterBlock title={t("filters.shopFor")}>
            <FilterLink active={audience === "all"} onClick={() => setParam("audience", "all")}>
              {t("common.all")} ({listing.total})
            </FilterLink>
            {listing.facets.audiences.map((a) => (
              <FilterLink
                key={a.slug}
                active={audience === a.slug}
                onClick={() => setParam("audience", a.slug)}
              >
                {audienceName(a.slug, t)} ({a.count})
              </FilterLink>
            ))}
          </FilterBlock>
        ) : null}

        {listing.facets.subs.length > 0 && listing.facets.subs.length <= 12 ? (
          <FilterBlock title={t("filters.type")}>
            <FilterLink active={sub === "all"} onClick={() => setParam("sub", "all")}>
              {t("common.all")} ({listing.total})
            </FilterLink>
            {listing.facets.subs.map((s) => (
              <FilterLink
                key={s.slug}
                active={sub === s.slug}
                onClick={() => setParam("sub", s.slug)}
              >
                {subName(s.slug, t)} ({s.count})
              </FilterLink>
            ))}
          </FilterBlock>
        ) : null}

        {listing.facets.sizes.length > 1 ? (
          <FilterBlock title={t("filters.size")}>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setParam("size", "all")}
                className={cn(
                  "inline-flex h-11 min-w-11 items-center justify-center rounded-full border px-3 text-xs font-medium uppercase tracking-wide transition-colors",
                  size === "all"
                    ? "border-[var(--accent)] text-[var(--accent)]"
                    : "border-[var(--border-strong)] text-[var(--muted)] hover:border-[var(--text)] hover:text-ink",
                )}
              >
                {t("common.all")}
              </button>
              {listing.facets.sizes.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setParam("size", s)}
                  className={cn(
                    "inline-flex h-11 min-w-11 items-center justify-center rounded-full border px-3 text-xs font-medium uppercase tracking-wide transition-colors",
                    size === s
                      ? "border-[var(--accent)] text-[var(--accent)]"
                      : "border-[var(--border-strong)] text-[var(--muted)] hover:border-[var(--text)] hover:text-ink",
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </FilterBlock>
        ) : null}

        <FilterBlock title={t("filters.price")}>
          <Input
            key={`${market}-${maxPrice}`}
            type="number"
            min={0}
            step={market === "eu" ? "0.01" : "1"}
            placeholder={t("filters.maxPlaceholder", { symbol: currencySymbol(market) })}
            defaultValue={
              maxPrice
                ? String(convertFromNad(Number(maxPrice), market))
                : ""
            }
            onBlur={(e) => {
              const raw = e.target.value.trim();
              if (!raw) {
                setParam("max", "");
                return;
              }
              const display = Number(raw);
              if (!Number.isFinite(display)) return;
              setParam("max", String(convertToNad(display, market)));
            }}
          />
        </FilterBlock>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            setParam("q", draftQ);
          }}
          className="space-y-2"
        >
          <Label>{t("filters.search")}</Label>
          <Input
            value={draftQ}
            onChange={(e) => setDraftQ(e.target.value)}
            placeholder={t("filters.codeOrName")}
          />
        </form>

        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => go(basePath)}
        >
          {t("filters.clear")}
        </Button>
      </aside>

      <div className={cn("min-w-0 transition-opacity duration-300", pending && "opacity-50")}>
        <div className="mb-5 flex items-center justify-between gap-3">
          <p className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
            {t.plural("count.pieces", listing.total)}
            {listing.pageCount > 1
              ? t("filters.pageOf", { page: listing.page, pageCount: listing.pageCount })
              : ""}
          </p>
          {layoutToggle ? (
            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label={t("common.gridView")}
                onClick={() => setLayout("grid")}
                className={cn(
                  "flex h-11 w-11 items-center justify-center rounded-full transition-colors",
                  layout === "grid" ? "bg-[var(--hover-strong)] text-[var(--accent)]" : "text-[var(--muted-2)] hover:text-ink",
                )}
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                type="button"
                aria-label={t("common.listView")}
                onClick={() => setLayout("list")}
                className={cn(
                  "flex h-11 w-11 items-center justify-center rounded-full transition-colors",
                  layout === "list" ? "bg-[var(--hover-strong)] text-[var(--accent)]" : "text-[var(--muted-2)] hover:text-ink",
                )}
              >
                <List className="h-4 w-4" />
              </button>
            </div>
          ) : null}
        </div>
        {listing.total === 0 ? (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-6 py-16 text-center">
            <p className="text-lg font-semibold text-ink">
              {emptyTitle ?? t("search.noProducts")}
            </p>
            <p className="mt-2 text-sm text-[var(--muted)]">
              {emptyBody ?? t("search.noProductsBody")}
            </p>
          </div>
        ) : (
          <>
            {children ?? (
              <ProductGrid
                products={listing.products}
                grouped={grouped}
                layout={layout}
                groupCounts={Object.fromEntries(
                  listing.facets.subs.map((s) => [s.slug, s.count]),
                )}
              />
            )}
            <ListingPagination
              page={listing.page}
              pageCount={listing.pageCount}
              hrefFor={pageHref}
              onNavigate={onNavigate}
            />
          </>
        )}
      </div>
    </div>
  );
}

function FilterBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
        {title}
      </p>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function FilterLink({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "block min-h-11 w-full rounded-md py-2.5 pl-2 text-left text-xs uppercase tracking-[0.12em] transition-colors",
        active
          ? "border-l-2 border-[var(--accent)] pl-[6px] font-semibold text-[var(--accent)]"
          : "text-[var(--text-secondary)] hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}
