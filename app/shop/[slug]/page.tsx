import { notFound } from "next/navigation";
import { AudienceLandingGrid } from "@/components/audience-landing";
import { CatalogBrowser } from "@/components/catalog-browser";
import { FolderGrid } from "@/components/folder-grid";
import { PageHeader } from "@/components/page-header";
import {
  AUDIENCES,
  CATEGORIES,
  CATEGORY_ALIASES,
  TYPE_FOLDERS,
  audienceBySlug,
  categoryBySlug,
  resolveCategorySlug,
} from "@/lib/catalog";
import {
  audienceHubGroups,
  categoryHubFolders,
  jomaChildFolderGroups,
  typeFolderLeafGroups,
  accessoriesLandingTiles,
  audienceLandingTiles,
  footwearLandingTiles,
  kidsLandingTiles,
  subcategoryHubGroups,
  jomaFolderAncestorKeys,
  jomaFolderHasChildren,
  type HubFolderTile,
} from "@/lib/hubs";
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

function groupHref(
  key: string,
  shopPath: string,
  audienceFromPath: string | undefined,
  activeAudience: string | undefined,
  hubSlug: string,
) {
  if (audienceFromPath) {
    return `${shopPath}?group=${encodeURIComponent(key)}`;
  }
  if (activeAudience) {
    return `/shop/${hubSlug}?audience=${activeAudience}&group=${encodeURIComponent(key)}`;
  }
  return `/shop/${hubSlug}?group=${encodeURIComponent(key)}`;
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
    group: firstSearchParam(sp.group),
    size: firstSearchParam(sp.size),
    max: firstSearchParam(sp.max),
    audience: activeAudience?.slug,
    page: firstSearchParam(sp.page),
  });
  const viewAll = firstSearchParam(sp.view) === "all";
  const groupKey = query.group && query.group !== "all" ? query.group : "";
  const subKey = query.sub && query.sub !== "all" ? query.sub : "";

  const hasTypeOrSearchFilter = listingQueryIsActive(query, {
    categorySlug: audienceFromPath ? undefined : hubSlug,
    audienceSlug: activeAudience?.slug,
  });
  const hasKidsAgeOrGender =
    Boolean(firstSearchParam(sp.age)) || Boolean(firstSearchParam(sp.gender));

  const hasProductFilters = listingQueryIsActive(
    { ...query, group: undefined },
    {
      categorySlug: audienceFromPath ? undefined : hubSlug,
      audienceSlug: activeAudience?.slug,
    },
  );

  const wantsProducts =
    viewAll ||
    hasProductFilters ||
    Boolean(subKey) ||
    Boolean(groupKey && !jomaFolderHasChildren(groupKey) && !TYPE_FOLDERS[groupKey]);

  const catalog = await getCatalog();

  const jomaLandingAudience =
    audienceFromPath?.slug === "men" || audienceFromPath?.slug === "women"
      ? audienceFromPath.slug
      : null;
  const showJomaLanding =
    Boolean(jomaLandingAudience) &&
    firstSearchParam(sp.view) !== "all" &&
    !hasTypeOrSearchFilter;

  if (showJomaLanding && jomaLandingAudience) {
    const tiles = audienceLandingTiles(jomaLandingAudience, catalog);
    const titleKey = jomaLandingAudience === "men" ? "nav.man" : "nav.woman";
    return (
      <div className="bg-white">
        <PageHeader
          compact
          wide
          crumbs={[
            { href: "/", key: "common.home" },
            { key: titleKey },
          ]}
          titleKey={titleKey}
        />
        <div className="page-shell page-shell--browse pb-8 pt-1 sm:pb-10">
          <AudienceLandingGrid tiles={tiles} />
        </div>
      </div>
    );
  }

  const showKidsLanding =
    audienceFromPath?.slug === "kids" &&
    firstSearchParam(sp.view) !== "all" &&
    !hasTypeOrSearchFilter &&
    !hasKidsAgeOrGender;

  if (showKidsLanding) {
    const tiles = kidsLandingTiles(catalog);
    return (
      <div className="bg-white">
        <PageHeader
          compact
          crumbs={[
            { href: "/", key: "common.home" },
            { key: "nav.children" },
          ]}
          titleKey="nav.children"
        />
        <div className="page-shell pb-8 pt-1 sm:pb-10">
          <AudienceLandingGrid tiles={tiles} variant="kids" />
        </div>
      </div>
    );
  }

  const showFootwearLanding =
    !audienceFromPath &&
    hubSlug === "shoes" &&
    !activeAudience &&
    firstSearchParam(sp.view) !== "all" &&
    !hasTypeOrSearchFilter;

  if (showFootwearLanding) {
    const tiles = footwearLandingTiles(catalog);
    return (
      <div className="bg-white">
        <PageHeader
          compact
          crumbs={[
            { href: "/", key: "common.home" },
            { key: "nav.footwear" },
          ]}
          titleKey="nav.footwear"
        />
        <div className="page-shell pb-8 pt-1 sm:pb-10">
          <AudienceLandingGrid tiles={tiles} variant="footwear" />
        </div>
      </div>
    );
  }

  const showAccessoriesLanding =
    !audienceFromPath &&
    hubSlug === "balls-bags" &&
    firstSearchParam(sp.view) !== "all" &&
    !hasTypeOrSearchFilter;

  if (showAccessoriesLanding) {
    const tiles = accessoriesLandingTiles(catalog);
    return (
      <div className="bg-white">
        <PageHeader
          compact
          crumbs={[
            { href: "/", key: "common.home" },
            { key: "nav.accessories" },
          ]}
          titleKey="nav.accessories"
        />
        <div className="page-shell pb-8 pt-1 sm:pb-10">
          <AudienceLandingGrid tiles={tiles} />
        </div>
      </div>
    );
  }

  const wantTypeFolders =
    firstSearchParam(sp.view) !== "all" && !hasTypeOrSearchFilter;

  let folders: HubFolderTile[] = [];
  if (wantTypeFolders) {
    const typeGroups = activeAudience
      ? audienceHubGroups(
          activeAudience.slug,
          catalog,
          audienceFromPath ? undefined : { categorySlug: hubSlug },
        )
      : hubSlug
      ? subcategoryHubGroups(hubSlug, catalog)
      : [];
    folders = typeGroups;
  } else if (!wantsProducts) {
    if (groupKey && jomaFolderHasChildren(groupKey)) {
      folders = jomaChildFolderGroups(groupKey, catalog, {
        categorySlug: audienceFromPath ? undefined : hubSlug,
        audience: activeAudience?.slug,
      });
    } else if (groupKey && TYPE_FOLDERS[groupKey]) {
      folders = typeFolderLeafGroups(groupKey, catalog, {
        categorySlug: audienceFromPath ? undefined : hubSlug,
        audience: activeAudience?.slug,
      });
    } else if (!groupKey) {
      folders = activeAudience
        ? audienceHubGroups(
            activeAudience.slug,
            catalog,
            audienceFromPath ? undefined : { categorySlug: hubSlug },
          )
        : categoryHubFolders(hubSlug, catalog);
    }
  }

  const showFolders = folders.length > 0;
  const listing = audienceFromPath
    ? buildListing(catalog, { ...query, audience: audienceFromPath.slug })
    : buildListing(catalog, query, { categorySlug: hubSlug });

  const shopPath = `/shop/${audienceFromPath ? audienceFromPath.slug : hubSlug}`;
  const ancestors = groupKey ? jomaFolderAncestorKeys(groupKey) : [];
  const shoesAudienceFromQuery =
    !audienceFromPath && hubSlug === "shoes" && Boolean(activeAudience);

  const crumbs = [
    { href: "/", key: "common.home" as const },
    audienceFromPath
      ? {
          href: groupKey || subKey || !showFolders ? shopPath : undefined,
          audience: audienceFromPath.slug,
        }
      : shoesAudienceFromQuery
        ? {
            href: "/shop/shoes",
            key: "nav.footwear" as const,
          }
        : { href: `/shop/${hubSlug}`, hub: hubSlug },
    ...(shoesAudienceFromQuery && activeAudience
      ? [
          {
            href:
              groupKey || subKey
                ? `/shop/shoes?audience=${activeAudience.slug}`
                : undefined,
            audience: activeAudience.slug,
          },
        ]
      : []),
    ...ancestors.map((key) => ({
      href: groupHref(
        key,
        shopPath,
        audienceFromPath?.slug,
        activeAudience?.slug,
        hubSlug,
      ),
      sub: key,
    })),
    ...(groupKey
      ? [
          {
            href:
              showFolders || subKey
                ? undefined
                : groupHref(
                    groupKey,
                    shopPath,
                    audienceFromPath?.slug,
                    activeAudience?.slug,
                    hubSlug,
                  ),
            sub: groupKey,
          },
        ]
      : []),
    ...(subKey ? [{ sub: subKey }] : []),
  ];

  const titleCount = showFolders
    ? undefined
    : groupKey || subKey
      ? listing.total
      : undefined;

  const titleAudienceSlug =
    !groupKey && !subKey
      ? audienceFromPath?.slug ?? (shoesAudienceFromQuery ? activeAudience?.slug : undefined)
      : undefined;

  return (
    <div>
      <PageHeader
        compact
        wide={showFolders}
        crumbs={crumbs}
        titleAudience={titleAudienceSlug}
        titleHub={
          !groupKey && !subKey && !titleAudienceSlug ? hubSlug : undefined
        }
        titleSub={subKey || groupKey || undefined}
        titleCount={titleCount}
      />
      <div
        className={
          showFolders
            ? "page-shell page-shell--browse pb-10 pt-1"
            : "page-shell pb-10 pt-1"
        }
      >
        {showFolders ? (
          <FolderGrid
            folders={folders}
            slug={audienceFromPath ? audienceFromPath.slug : hubSlug}
          />
        ) : (
          <CatalogBrowser
            initialListing={listing}
            categorySlug={audienceFromPath ? undefined : hubSlug}
            audienceSlug={audienceFromPath?.slug ?? activeAudience?.slug}
            basePath={shopPath}
            grouped
            hideFilters
            showCategoryFilter={false}
            showAudienceFilter={false}
            showLayoutToggle
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
