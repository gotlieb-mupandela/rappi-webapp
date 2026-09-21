import { notFound } from "next/navigation";
import { CatalogBrowser } from "@/components/catalog-browser";
import { HubTile } from "@/components/hub-tile";
import { PageHeader } from "@/components/page-header";
import { SectionHeading } from "@/components/section-heading";
import { TLink } from "@/components/t-link";
import {
  AUDIENCES,
  CATEGORIES,
  CATEGORY_ALIASES,
  audienceBySlug,
  categoryBySlug,
  resolveCategorySlug,
} from "@/lib/catalog";
import { audienceHubGroups } from "@/lib/hubs";
import { buildListing, listingQueryIsActive, parseListingQuery } from "@/lib/listing-core";
import { getCatalog } from "@/lib/supabase/catalog";

export const revalidate = 3600;

export function generateStaticParams() {
  return [
    ...CATEGORIES.map((c) => ({ slug: c.slug })),
    ...Object.keys(CATEGORY_ALIASES).map((slug) => ({ slug })),
    ...AUDIENCES.map((a) => ({ slug: a.slug })),
  ];
}

function firstSearchParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0];
  return value;
}

export default async function ShopListingPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const hubSlug = resolveCategorySlug(slug);
  const audienceFromPath = audienceBySlug(slug);
  const audienceFromQuery = audienceBySlug(firstSearchParam(sp.audience) ?? "");
  const activeAudience = audienceFromPath ?? audienceFromQuery;
  const cat = categoryBySlug(hubSlug);
  if (!audienceFromPath && !cat) notFound();

  const query = parseListingQuery({
    q: firstSearchParam(sp.q),
    cat: firstSearchParam(sp.cat),
    sub: firstSearchParam(sp.sub),
    size: firstSearchParam(sp.size),
    max: firstSearchParam(sp.max),
    audience: activeAudience?.slug,
    page: firstSearchParam(sp.page),
  });
  const hasTypeOrSearchFilter = listingQueryIsActive(query, {
    categorySlug: audienceFromPath ? undefined : hubSlug,
    audienceSlug: activeAudience?.slug,
  });
  const catalog = await getCatalog();
  const typeGroups =
    activeAudience && firstSearchParam(sp.view) !== "all" && !hasTypeOrSearchFilter
      ? audienceHubGroups(
          activeAudience.slug,
          catalog,
          audienceFromPath ? undefined : { categorySlug: hubSlug },
        )
      : [];
  const showFolders = typeGroups.length > 0;
  const listing = audienceFromPath
    ? buildListing(catalog, { ...query, audience: audienceFromPath.slug })
    : buildListing(catalog, query, { categorySlug: hubSlug });

  const backHref = audienceFromPath ? "/" : `/category/${hubSlug}`;
  const shopPath = `/shop/${audienceFromPath ? audienceFromPath.slug : hubSlug}`;
  const shopAllParams = new URLSearchParams();
  if (!audienceFromPath && activeAudience) shopAllParams.set("audience", activeAudience.slug);
  shopAllParams.set("view", "all");
  const shopAllHref = `${shopPath}?${shopAllParams.toString()}`;

  return (
    <div>
      <PageHeader
        crumbs={[
          { href: "/", key: "common.home" },
          audienceFromPath
            ? { audience: audienceFromPath.slug }
            : { href: `/category/${hubSlug}`, hub: hubSlug },
          { key: "common.products" },
        ]}
        eyebrowPlural="count.pieces"
        eyebrowCount={listing.total}
        titleAudience={audienceFromPath?.slug}
        titleHub={audienceFromPath ? undefined : hubSlug}
        descriptionAudience={audienceFromPath?.slug}
        descriptionHub={audienceFromPath ? undefined : hubSlug}
        actions={
          <TLink
            href={backHref}
            k={audienceFromPath ? "common.backToHome" : "common.backToHub"}
            variant="outline"
            className="w-full sm:w-auto"
          />
        }
      />
      <div className="page-shell py-8 sm:py-10">
        {showFolders ? (
          <section>
            <SectionHeading
              titleKey="shop.shopByType"
              href={shopAllHref}
              linkLabelKey="common.shopAll"
            />
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
              {typeGroups.map((g) => (
                <HubTile
                  key={g.key}
                  slug={audienceFromPath ? audienceFromPath.slug : hubSlug}
                  nameSubcategory={g.key}
                  count={g.count}
                  href={g.href}
                  product={g.sample}
                  shape="square"
                />
              ))}
            </div>
          </section>
        ) : (
          <CatalogBrowser
            initialListing={listing}
            categorySlug={audienceFromPath ? undefined : hubSlug}
            audienceSlug={audienceFromPath?.slug}
            basePath={shopPath}
            grouped
            showCategoryFilter={Boolean(audienceFromPath)}
            showAudienceFilter={!audienceFromPath}
            showLayoutToggle={false}
            emptyTitleKey={audienceFromPath ? "shop.emptyAudience" : "shop.emptyHub"}
            emptyKind={audienceFromPath ? "audience" : "hub"}
            emptySlug={audienceFromPath ? audienceFromPath.slug : hubSlug}
            emptyBodyKey="shop.emptyBody"
          />
        )}
      </div>
    </div>
  );
}
