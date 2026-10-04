"use client";

import { usePathname } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { useT } from "@/components/locale-provider";
import type { StorefrontTaxonomy } from "@/lib/listing-types";

export function StorefrontChrome({
  children,
  taxonomy,
  categoryCounts,
}: {
  children: ReactNode;
  taxonomy: StorefrontTaxonomy;
  categoryCounts: Record<string, number>;
}) {
  const pathname = usePathname();
  const t = useT();
  const isAdmin = pathname?.startsWith("/admin");
  const isLogin = pathname === "/login";
  const isHome = pathname === "/";
  // Joma browse landings are tile grids only — no storefront footer chrome.
  const hideFooter =
    isLogin ||
    isHome ||
    Boolean(
      pathname &&
        (pathname.startsWith("/shop") ||
          pathname.startsWith("/category") ||
          pathname.startsWith("/promotions") ||
          pathname === "/teamwear" ||
          pathname.startsWith("/search")),
    );

  // NOTE: no global listing-index prefetch — CatalogBrowser loads a slim
  // per-hub file only after the shopper uses filters or search.

  if (isAdmin) {
    return <>{children}</>;
  }

  return (
    <>
      <a href="#main" className="skip-link">
        {t("skip")}
      </a>
      <Suspense fallback={null}>
        <SiteHeader taxonomy={taxonomy} categoryCounts={categoryCounts} />
      </Suspense>
      <main id="main" key={pathname} className={isHome ? "flex-1" : "page-enter flex-1"}>
        {children}
      </main>
      {hideFooter ? null : <SiteFooter categoryCounts={categoryCounts} />}
    </>
  );
}
