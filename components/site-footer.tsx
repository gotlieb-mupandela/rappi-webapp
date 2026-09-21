"use client";

import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { SiteSocial } from "@/components/site-social";
import { useLocale } from "@/components/locale-provider";
import { AUDIENCES, CATEGORIES, TAGLINE } from "@/lib/catalog";
import { audienceName, hubName } from "@/lib/i18n/labels";

export function SiteFooter({
  categoryCounts,
}: {
  categoryCounts?: Record<string, number>;
}) {
  const { t, market } = useLocale();

  return (
    <footer className="mt-auto border-t border-[var(--border)] bg-[var(--footer-bg)]">
      <div className="page-shell grid gap-10 py-12 md:grid-cols-3">
        <div>
          <BrandLogo className="h-24 w-auto" />
          <p className="mt-3 text-xs uppercase tracking-[0.2em] text-[var(--accent)]">
            {t("home.tagline") === "home.tagline" ? TAGLINE : t("home.tagline")}
          </p>
          <p className="mt-4 max-w-sm text-sm leading-6 text-[var(--muted)]">
            {market === "eu" ? t("footer.blurbEur") : t("footer.blurbNad")}
          </p>
          <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
            {t("footer.visit")}
          </p>
          <p className="mt-2 max-w-sm text-sm leading-6 text-[var(--muted)]">
            <Link href="/store" className="font-semibold text-ink transition-colors hover:text-[var(--accent)]">
              {t("footer.findStore")}
            </Link>
            <span className="mt-1 block">{t("footer.findStoreBody")}</span>
          </p>
          <SiteSocial />
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
            {t("footer.shop")}
          </p>
          <ul className="mt-4 grid grid-cols-2 gap-y-2 text-sm">
            {AUDIENCES.map((a) => (
              <li key={a.slug}>
                <Link
                  href={`/shop/${a.slug}`}
                  className="text-ink/90 transition-colors hover:text-[var(--accent)]"
                >
                  {audienceName(a.slug, t)}
                </Link>
              </li>
            ))}
            {CATEGORIES.filter((c) => !categoryCounts || (categoryCounts[c.slug] ?? 0) > 0).map(
              (c) => (
              <li key={c.slug}>
                <Link
                  href={`/category/${c.slug}`}
                  className="text-ink/90 transition-colors hover:text-[var(--accent)]"
                >
                  {hubName(c.slug, t)}
                </Link>
              </li>
              ),
            )}
          </ul>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
            {t("footer.account")}
          </p>
          <ul className="mt-4 space-y-2 text-sm">
            <li>
              <Link href="/login" className="transition-colors hover:text-[var(--accent)]">
                {t("footer.login")}
              </Link>
            </li>
            <li>
              <Link href="/account/orders" className="transition-colors hover:text-[var(--accent)]">
                {t("footer.orders")}
              </Link>
            </li>
            <li>
              <Link href="/cart" className="transition-colors hover:text-[var(--accent)]">
                {t("footer.cart")}
              </Link>
            </li>
            <li>
              <Link href="/promotions" className="transition-colors hover:text-[var(--accent)]">
                {t("nav.newCollections")}
              </Link>
            </li>
            <li>
              <Link href="/search" className="transition-colors hover:text-[var(--accent)]">
                {t("footer.search")}
              </Link>
            </li>
            <li>
              <Link href="/teamwear" className="transition-colors hover:text-[var(--accent)]">
                {t("home.teamwearCta")}
              </Link>
            </li>
            <li>
              <Link href="/store" className="transition-colors hover:text-[var(--accent)]">
                {t("footer.findStore")}
              </Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-[var(--border)] py-4 text-center text-[11px] tracking-wide text-[var(--muted-2)]">
        {t("footer.legal")}
      </div>
    </footer>
  );
}
