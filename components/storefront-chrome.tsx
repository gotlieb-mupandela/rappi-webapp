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

  // NOTE: no global listing-index prefetch — it is an 11MB download that
  // CatalogBrowser already fetches on demand on catalog pages. Prefetching
  // it here taxed every homepage visit for zero benefit.

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
      {isLogin || isHome ? null : <SiteFooter categoryCounts={categoryCounts} />}
    </>
  );
}
