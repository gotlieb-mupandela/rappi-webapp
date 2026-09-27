import { notFound } from "next/navigation";
import Link from "next/link";
import { FolderGrid } from "@/components/folder-grid";
import { HubTile } from "@/components/hub-tile";
import { PageHeader } from "@/components/page-header";
import { ProductImage } from "@/components/product-image";
import { SectionHeading } from "@/components/section-heading";
import { NoStockBody } from "@/components/no-stock-body";
import { OtherHubsNav } from "@/components/other-hubs-nav";
import { TLink } from "@/components/t-link";
import { Translated } from "@/components/translated";
import { CATEGORIES, CATEGORY_ALIASES, categoryBySlug, resolveCategorySlug } from "@/lib/catalog";
import { sampleForCategory } from "@/lib/classify";
import { audienceTiles, categoryHubFolders } from "@/lib/hubs";
import { productsByCategory } from "@/lib/products";
import { getCatalog } from "@/lib/supabase/catalog";
import { productPath } from "@/lib/utils";

export const revalidate = 3600;

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
  const sample = sampleForCategory(catalog, hubSlug);
  const typeGroups = categoryHubFolders(hubSlug, catalog);
  const audiences = audienceTiles(catalog, { categorySlug: hubSlug });
  const otherHubs = CATEGORIES.filter(
    (c) => c.slug !== hubSlug && sampleForCategory(catalog, c.slug),
  );
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
        descriptionHub={hubSlug}
        actions={
          items.length ? (
            <>
              <TLink
                href={folderLandingHref}
                k="shop.shopByType"
                size="lg"
                className="w-full sm:w-auto"
              />
              <TLink
                href={shopAllHref}
                k="common.shopAll"
                size="lg"
                variant="outline"
                className="w-full sm:w-auto"
              />
            </>
          ) : (
            <TLink
              href="/search"
              k="common.browseCatalog"
              size="lg"
              className="w-full sm:w-auto"
            />
          )
        }
        media={
          sample ? (
            <Link
              href={productPath(sample.code)}
              className="media-frame group relative block overflow-hidden rounded-lg border border-[var(--border)]"
            >
              <ProductImage
                product={sample}
                src={sample.imageUrl}
                alt={sample.displayName}
                priority
                className="aspect-[4/5] w-full object-cover transition-transform duration-700 group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
                fallbackClassName="aspect-[4/5] w-full"
              />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-4">
                <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-[var(--accent)]">
                  <Translated k="common.featured" />
                </p>
                <p className="mt-1 truncate font-[family-name:var(--font-oswald)] text-sm uppercase text-white">
                  {sample.displayName}
                </p>
              </div>
            </Link>
          ) : null
        }
      />
      <div className="page-shell py-10 lg:py-14">
        {typeGroups.length > 0 ? (
          <section className="mb-12 lg:mb-16">
            <SectionHeading
              titleKey="shop.shopByType"
              href={shopAllHref}
              linkLabelKey="common.shopAll"
            />
            <FolderGrid folders={typeGroups} slug={hubSlug} />
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
              {audiences.map((g) => (
                <HubTile
                  key={g.key}
                  slug={hubSlug}
                  nameAudience={g.key}
                  count={g.count}
                  href={g.href}
                  product={g.sample}
                  imageSrc={g.cover}
                  shape="square"
                  imageFit={g.cover ? "contain" : "cover"}
                  priority
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

        {otherHubs.length ? <OtherHubsNav hubs={otherHubs.map((c) => c.slug)} /> : null}
      </div>
    </div>
  );
}
