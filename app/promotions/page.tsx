import { redirect } from "next/navigation";
import { AudienceLandingGrid } from "@/components/audience-landing";
import { CatalogBrowser } from "@/components/catalog-browser";
import { PageHeader } from "@/components/page-header";
import { outletLandingTiles } from "@/lib/hubs";
import { isJomaBrowseFolder, isOutletFolderKey, jomaFolderAncestorKeys } from "@/lib/joma-tree";
import { outletGroupForLegacyMax } from "@/lib/joma-nav";
import { buildListing, parseListingQuery } from "@/lib/listing-core";
import { getCatalog } from "@/lib/supabase/catalog";

export const revalidate = 3600;

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
  const groupParam = firstSearchParam(sp.group) ?? "";
  const maxParam = firstSearchParam(sp.max);
  const viewAll = firstSearchParam(sp.view) === "all";

  // Legacy `?view=all` and `?max=N` links used to render the New Collections
  // hub (badge filter, NAD max). Send them to the Part B outlet folder.
  if (!groupParam || groupParam === "all") {
    const legacyGroup = outletGroupForLegacyMax(maxParam);
    if (legacyGroup) redirect(`/promotions?group=${legacyGroup}`);
    if (viewAll || maxParam) redirect("/promotions?group=outlet-promotions");
  }

  const folderKey =
    groupParam && groupParam !== "all" && isJomaBrowseFolder(groupParam) && isOutletFolderKey(groupParam)
      ? groupParam
      : "";

  const catalog = await getCatalog();

  if (!folderKey) {
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

  const query = parseListingQuery({
    q: firstSearchParam(sp.q),
    sub: firstSearchParam(sp.sub),
    group: folderKey,
    size: firstSearchParam(sp.size),
    audience: firstSearchParam(sp.audience),
    page: firstSearchParam(sp.page),
  });
  // Folder membership is the filter. Do not also require badge offer/new —
  // this catalog has none, which made every outlet child an empty New Collections page.
  const listing = buildListing(catalog, query);
  const ancestors = jomaFolderAncestorKeys(folderKey);

  return (
    <div>
      <PageHeader
        compact
        crumbs={[
          { href: "/", key: "common.home" },
          { href: "/promotions", key: "nav.outlet" },
          ...ancestors.map((key) => ({
            href: `/promotions?group=${encodeURIComponent(key)}`,
            sub: key,
          })),
          { sub: folderKey },
        ]}
        titleSub={folderKey}
        titleCount={listing.total}
      />
      <div className="page-shell pb-10 pt-1">
        <CatalogBrowser
          initialListing={listing}
          basePath="/promotions"
          grouped
          hideFilters
          showCategoryFilter={false}
          showAudienceFilter={false}
          showLayoutToggle
          emptyBodyKey="shop.emptyBody"
        />
      </div>
    </div>
  );
}
