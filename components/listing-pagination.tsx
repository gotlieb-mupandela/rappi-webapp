"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useT } from "@/components/locale-provider";

export function ListingPagination({
  page,
  pageCount,
  hrefFor,
  onNavigate,
}: {
  page: number;
  pageCount: number;
  hrefFor: (page: number) => string;
  onNavigate?: (href: string) => void;
}) {
  const t = useT();
  if (pageCount <= 1) return null;

  const window: number[] = [];
  const start = Math.max(1, page - 2);
  const end = Math.min(pageCount, page + 2);
  for (let n = start; n <= end; n += 1) window.push(n);

  return (
    <nav
      aria-label={t("common.pagination")}
      className="mt-10 flex flex-wrap items-center justify-center gap-2"
    >
      <PageLink href={page > 1 ? hrefFor(page - 1) : null} rel="prev" onNavigate={onNavigate}>
        {t("common.previous")}
      </PageLink>
      {start > 1 ? (
        <>
          <PageLink href={hrefFor(1)} active={page === 1} onNavigate={onNavigate}>
            1
          </PageLink>
          {start > 2 ? <span className="px-1 text-[var(--muted-2)]">…</span> : null}
        </>
      ) : null}
      {window.map((n) => (
        <PageLink key={n} href={hrefFor(n)} active={n === page} onNavigate={onNavigate}>
          {n}
        </PageLink>
      ))}
      {end < pageCount ? (
        <>
          {end < pageCount - 1 ? <span className="px-1 text-[var(--muted-2)]">…</span> : null}
          <PageLink href={hrefFor(pageCount)} active={page === pageCount} onNavigate={onNavigate}>
            {pageCount}
          </PageLink>
        </>
      ) : null}
      <PageLink href={page < pageCount ? hrefFor(page + 1) : null} rel="next" onNavigate={onNavigate}>
        {t("common.next")}
      </PageLink>
    </nav>
  );
}

function scrollListingToTop() {
  window.scrollTo({ top: 0, left: 0, behavior: "instant" });
}

function PageLink({
  href,
  active,
  rel,
  children,
  onNavigate,
}: {
  href: string | null;
  active?: boolean;
  rel?: string;
  children: ReactNode;
  onNavigate?: (href: string) => void;
}) {
  const className = cn(
    "inline-flex h-10 min-w-10 items-center justify-center rounded-full border px-3 text-xs font-semibold uppercase tracking-wider",
    active
      ? "border-[var(--accent)] text-[var(--accent)]"
      : "border-[var(--border-strong)] text-[var(--muted)] hover:border-[var(--text)] hover:text-ink",
    !href && "pointer-events-none opacity-35",
  );
  if (!href) {
    return <span className={className}>{children}</span>;
  }
  return (
    <Link
      href={href}
      rel={rel}
      className={className}
      onClick={(event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
          return;
        }
        scrollListingToTop();
        if (!onNavigate) return;
        event.preventDefault();
        onNavigate(href);
      }}
    >
      {children}
    </Link>
  );
}
