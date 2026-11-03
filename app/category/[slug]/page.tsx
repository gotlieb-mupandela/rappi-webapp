import { notFound } from "next/navigation";
import { FolderGrid } from "@/components/folder-grid";
import { HubTile } from "@/components/hub-tile";
import { PageHeader } from "@/components/page-header";
import { SectionHeading } from "@/components/section-heading";
import { NoStockBody } from "@/components/no-stock-body";
import { TLink } from "@/components/t-link";
import { Translated } from "@/components/translated";
import { CATEGORIES, CATEGORY_ALIASES, categoryBySlug, resolveCategorySlug } from "@/lib/catalog";
import { audienceTiles, categoryHubFolders } from "@/lib/hubs";
import { toClientProduct, toClientSamples } from "@/lib/listing-core";
import { productsByCategory } from "@/lib/products";
import { getCatalog } from "@/lib/supabase/catalog";

export const revalidate = 21600;

export function generateStaticParams() {
  return [
    ...CATEGORIES.map((c) => ({ slug: c.slug })),
    ...Object.keys(CATEGORY_ALIASES).map((slug) => ({ slug })),
  ];
}

export default async function CategoryHubPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const hubSlug = resolveCategorySlug(slug);
  const cat = categoryBySlug(hubSlug);
  if (!cat) notFound();
  const catalog = await getCatalog();
  const items = productsByCategory(hubSlug, catalog);
  const typeGroups = categoryHubFolders(hubSlug, catalog);
  const audiences = audienceTiles(catalog, { categorySlug: hubSlug });
  const shopAllHref = `/shop/${hubSlug}?view=all`;
  const folderLandingHref = `/shop/${hubSlug}`;

  return (
    <div>
      <PageHeader
        crumbs={[{ href: "/", key: "common.home" }, { hub: hubSlug }]}
        eyebrowPlural={items.length ? "count.pieces" : undefined}
        eyebrowCount={items.length || undefined}
        eyebrowKey={items.length ? undefined : "shop.hub"}
        titleHub={hubSlug}
      />
      <div className="page-shell py-10 lg:py-14">
        {typeGroups.length > 0 ? (
          <section className="mb-12 lg:mb-16">
            <SectionHeading
              titleKey="shop.shopByType"
              href={shopAllHref}
              linkLabelKey="common.shopAll"
            />
            <FolderGrid folders={toClientSamples(typeGroups)} slug={hubSlug} />
          </section>
        ) : null}

        {audiences.length > 1 ? (
          <section className="mb-12 lg:mb-16">
            <SectionHeading
              titleKey="shop.shopByAthlete"
              href={folderLandingHref}
              linkLabelKey="common.shopAll"
            />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 md:gap-4">
              {audiences.map((g, i) => (
                <HubTile
                  key={g.key}
                  slug={hubSlug}
                  nameAudience={g.key}
                  count={g.count}
                  href={g.href}
                  product={g.sample ? toClientProduct(g.sample) : undefined}
                  imageSrc={g.cover}
                  shape="square"
                  imageFit={g.cover ? "contain" : "cover"}
                  priority={typeGroups.length === 0 && i < 2}
                />
              ))}
            </div>
          </section>
        ) : null}

        {!typeGroups.length && !items.length ? (
          <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-6 py-16 text-center">
            <p className="font-[family-name:var(--font-oswald)] text-2xl uppercase text-ink">
              <Translated k="shop.noStockTitle" />
            </p>
            <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-[var(--muted)]">
              <NoStockBody hubSlug={hubSlug} />
            </p>
            <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
              <TLink href="/category/sportswear" k="home.shopSportswear" />
              <TLink href="/search" k="common.browseCatalog" variant="outline" />
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
