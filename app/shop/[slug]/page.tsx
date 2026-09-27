import { notFound } from "next/navigation";
import { CatalogBrowser } from "@/components/catalog-browser";
import { FolderGrid } from "@/components/folder-grid";
import { PageHeader } from "@/components/page-header";
import { TLink } from "@/components/t-link";
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
  type HubFolderTile,
} from "@/lib/hubs";
import {
  jomaFolderAncestorKeys,
  jomaFolderHasChildren,
  jomaFolderParentKey,
} from "@/lib/joma-tree";
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

  let folders: HubFolderTile[] = [];
  if (!wantsProducts) {
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
  const parentKey = groupKey ? jomaFolderParentKey(groupKey) : undefined;
  const backHref = parentKey
    ? groupHref(
        parentKey,
        shopPath,
        audienceFromPath?.slug,
        activeAudience?.slug,
        hubSlug,
      )
    : groupKey
      ? shopPath
      : audienceFromPath
        ? "/"
        : `/category/${hubSlug}`;

  const ancestors = groupKey ? jomaFolderAncestorKeys(groupKey) : [];

  const crumbs = [
    { href: "/", key: "common.home" as const },
    audienceFromPath
      ? {
          href: groupKey || subKey || !showFolders ? shopPath : undefined,
          audience: audienceFromPath.slug,
        }
      : { href: `/category/${hubSlug}`, hub: hubSlug },
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

  return (
    <div>
      <PageHeader
        compact={showFolders}
        crumbs={crumbs}
        titleAudience={!groupKey && !subKey ? audienceFromPath?.slug : undefined}
        titleHub={
          !groupKey && !subKey && !audienceFromPath ? hubSlug : undefined
        }
        titleSub={subKey || groupKey || undefined}
        titleCount={titleCount}
        descriptionAudience={
          showFolders || subKey || groupKey ? undefined : audienceFromPath?.slug
        }
        descriptionHub={
          showFolders || audienceFromPath || subKey || groupKey
            ? undefined
            : hubSlug
        }
        actions={
          showFolders ? undefined : (
            <TLink
              href={backHref}
              k="back"
              variant="outline"
              className="w-full sm:w-auto"
            />
          )
        }
      />
      <div className={showFolders ? "page-shell pb-10 pt-1" : "page-shell py-8 sm:py-10"}>
        {showFolders ? (
          <FolderGrid
            folders={folders}
            slug={audienceFromPath ? audienceFromPath.slug : hubSlug}
          />
        ) : (
          <CatalogBrowser
            initialListing={listing}
            categorySlug={audienceFromPath ? undefined : hubSlug}
            audienceSlug={audienceFromPath?.slug}
            basePath={shopPath}
            grouped
            showCategoryFilter={Boolean(audienceFromPath)}
            showAudienceFilter={!audienceFromPath}
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
