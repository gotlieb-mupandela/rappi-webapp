"use client";

import Link from "next/link";
import { ArrowUpRight, MapPin } from "lucide-react";
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
  const tagline =
    t("home.tagline") === "home.tagline" ? TAGLINE : t("home.tagline");
  const shopLinks = [
    ...AUDIENCES.map((a) => ({
      href: `/shop/${a.slug}`,
      label: audienceName(a.slug, t),
    })),
    ...CATEGORIES.filter((c) => !categoryCounts || (categoryCounts[c.slug] ?? 0) > 0)
      .slice(0, 4)
      .map((c) => ({
        href: `/category/${c.slug}`,
        label: hubName(c.slug, t),
      })),
  ];
  const accountLinks = [
    { href: "/login", label: t("footer.login") },
    { href: "/account/orders", label: t("footer.orders") },
    { href: "/cart", label: t("footer.cart") },
    { href: "/teamwear", label: t("home.teamwearEyebrow") },
    { href: "/store", label: t("footer.findStore") },
  ];

  return (
    <footer className="mt-auto border-t border-[var(--border)] bg-[var(--footer-bg)]">
      <div className="page-shell py-6 sm:py-7">
        <div className="grid gap-6 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)] md:items-start md:gap-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div className="min-w-0">
            <BrandLogo className="h-11 w-auto sm:h-12" />
            <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
              {tagline}
            </p>
            <p className="mt-2 max-w-sm text-xs leading-5 text-[var(--muted)]">
              {market === "eu" ? t("footer.blurbEur") : t("footer.blurbNad")}
            </p>
            <SiteSocial variant="icons" className="mt-3" />
          </div>

          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-secondary)]">
              {t("footer.shop")}
            </p>
            <ul className="mt-2.5 columns-2 gap-x-6 space-y-1.5 text-xs">
              {shopLinks.map((link) => (
                <li key={link.href} className="break-inside-avoid">
                  <Link
                    href={link.href}
                    className="text-[var(--muted)] transition-colors hover:text-[var(--accent)]"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-secondary)]">
              {t("footer.account")}
            </p>
            <ul className="mt-2.5 space-y-1.5 text-xs">
              {accountLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-[var(--muted)] transition-colors hover:text-[var(--accent)]"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <Link
            href="/store"
            className="group flex items-center gap-3 rounded-xl border border-[var(--border)] bg-white px-3.5 py-3 transition-[border-color,box-shadow] duration-200 hover:border-[var(--border-strong)] hover:shadow-[var(--shadow-soft)] md:col-span-3 lg:col-span-1"
          >
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--accent-muted)] text-[var(--accent)]">
              <MapPin className="h-3.5 w-3.5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
                {t("footer.visit")}
              </span>
              <span className="mt-0.5 block truncate text-sm font-semibold text-[var(--text-secondary)]">
                {t("footer.findStore")}
              </span>
            </span>
            <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-[var(--accent)] transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </Link>
        </div>
      </div>

      <div className="border-t border-[var(--border)] bg-white/60">
        <div className="page-shell flex flex-col gap-1 py-2.5 text-[10px] tracking-wide text-[var(--muted-2)] sm:flex-row sm:items-center sm:justify-between">
          <p>{t("footer.legal")}</p>
          <p className="uppercase tracking-[0.14em] text-[var(--muted)]">RAPPI SPORTS HUB</p>
        </div>
      </div>
    </footer>
  );
}
