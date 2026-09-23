import { AudienceLandingGrid } from "@/components/audience-landing";
import { CatalogBrowser } from "@/components/catalog-browser";
import { PageHeader } from "@/components/page-header";
import { Translated } from "@/components/translated";
import { outletLandingTiles } from "@/lib/hubs";
import {
  buildListing,
  listingQueryIsActive,
  parseListingQuery,
} from "@/lib/listing-core";
import { getCatalog } from "@/lib/supabase/catalog";

export const revalidate = 3600;

const PROMO_BADGES = ["offer", "new"] as const;

function firstSearchParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0];
  return value;
}

export default async function PromotionsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const catalog = await getCatalog();
  const query = parseListingQuery({
    q: firstSearchParam(sp.q),
    cat: firstSearchParam(sp.cat),
    sub: firstSearchParam(sp.sub),
    group: firstSearchParam(sp.group),
    size: firstSearchParam(sp.size),
    max: firstSearchParam(sp.max),
    audience: firstSearchParam(sp.audience),
    page: firstSearchParam(sp.page),
  });
  const showListing =
    firstSearchParam(sp.view) === "all" || listingQueryIsActive(query);

  if (!showListing) {
    const tiles = outletLandingTiles(catalog);
    return (
      <div className="bg-white">
        <PageHeader
          crumbs={[{ href: "/", key: "common.home" }, { key: "nav.outlet" }]}
          titleKey="nav.outlet"
        />
        <div className="page-shell pb-10 pt-2 sm:pb-12 sm:pt-3">
          <AudienceLandingGrid tiles={tiles} variant="outlet" />
        </div>
      </div>
    );
  }

  const listing = buildListing(catalog, query, { badges: [...PROMO_BADGES] });

  return (
    <div>
      <PageHeader
        crumbs={[
          { href: "/", key: "common.home" },
          { href: "/promotions", key: "nav.outlet" },
          { key: "promotions.crumb" },
        ]}
        eyebrowKey="promotions.eyebrow"
        titleKey="promotions.title"
        descriptionKey="promotions.description"
      />
      <div className="page-shell py-10 lg:py-14">
        {listing.total === 0 ? (
          <p className="text-sm text-[var(--muted)]">
            <Translated k="promotions.none" />
          </p>
        ) : (
          <CatalogBrowser
            initialListing={listing}
            basePath="/promotions"
            grouped
            badges={[...PROMO_BADGES]}
          />
        )}
      </div>
    </div>
  );
}
