import { notFound } from "next/navigation";
import Link from "next/link";
import { HubTile } from "@/components/hub-tile";
import { PageHeader } from "@/components/page-header";
import { ProductCard } from "@/components/product-card";
import { ProductImage } from "@/components/product-image";
import { SectionHeading } from "@/components/section-heading";
import { NoStockBody } from "@/components/no-stock-body";
import { OtherHubsNav } from "@/components/other-hubs-nav";
import { TLink } from "@/components/t-link";
import { Translated } from "@/components/translated";
import { CATEGORIES, CATEGORY_ALIASES, categoryBySlug, resolveCategorySlug } from "@/lib/catalog";
import { sampleForCategory } from "@/lib/classify";
import {
  audienceTiles,
  bramaHubGroups,
  shoeHubGroups,
  subcategoryHubGroups,
} from "@/lib/hubs";
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
  const preview =
    hubSlug === "rugby"
      ? [...items]
          .sort((a, b) => {
            const rank = (name: string) => {
              const n = name.toLowerCase();
              if (/\b(helmet|protection|protec)\b/.test(n)) return 2;
              if (/\bball\b/.test(n)) return 1;
              return 0;
            };
            return rank(a.displayName) - rank(b.displayName);
          })
          .slice(0, 12)
      : items.slice(0, 12);
  const shoeGroups = hubSlug === "shoes" ? shoeHubGroups(catalog) : [];
  const bramaGroups = hubSlug === "brama" ? bramaHubGroups(catalog) : [];
  const hasCustomGroups = shoeGroups.length > 0 || bramaGroups.length > 0;
  const typeGroups = hasCustomGroups ? [] : subcategoryHubGroups(hubSlug, catalog);
  const audiences = audienceTiles(catalog, { categorySlug: hubSlug });
  const otherHubs = CATEGORIES.filter(
    (c) => c.slug !== hubSlug && sampleForCategory(catalog, c.slug),
  );

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
                href={`/shop/${hubSlug}`}
                k="common.shopAll"
                size="lg"
                className="w-full sm:w-auto"
              />
              <TLink
                href="/search"
                k="common.browseCatalog"
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
              href={`/shop/${hubSlug}`}
              linkLabelKey="common.shopAll"
            />
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
              {typeGroups.map((g) => (
                <HubTile
                  key={g.key}
                  slug={hubSlug}
                  nameSubcategory={g.key}
                  count={g.count}
                  href={g.href}
                  product={g.sample}
                  shape="square"
                />
              ))}
            </div>
          </section>
        ) : null}

        {audiences.length > 1 ? (
          <section className="mb-12 lg:mb-16">
            <SectionHeading
              titleKey="shop.shopByAthlete"
              href={`/shop/${hubSlug}`}
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

        {shoeGroups.length > 0 ? (
          <section className="mb-12 lg:mb-16">
            <SectionHeading
              titleKey="shop.shopByFit"
              href={`/shop/${hubSlug}`}
              linkLabelKey="shop.allShoes"
            />
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
              {shoeGroups.map((g) => (
                <HubTile
                  key={g.key}
                  slug={hubSlug}
                  nameGroup={{ kind: "shoes", key: g.key }}
                  count={g.count}
                  href={g.href}
                  product={g.sample}
                  bannerKey={g.banner ? "group.shoes.offersBanner" : undefined}
                  shape="square"
                />
              ))}
            </div>
          </section>
        ) : null}

        {bramaGroups.length > 0 ? (
          <section className="mb-12 lg:mb-16">
            <SectionHeading titleKey="shop.shopBrama" href="/shop/brama" linkLabelKey="shop.allBrama" />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 md:gap-4">
              {bramaGroups.map((g) => (
                <HubTile
                  key={g.key}
                  slug={hubSlug}
                  nameGroup={{ kind: "brama", key: g.key }}
                  count={g.count}
                  href={g.href}
                  product={g.sample}
                  shape="square"
                />
              ))}
            </div>
          </section>
        ) : null}

        {preview.length ? (
          <section>
            <SectionHeading
              titleKey="shop.inThisHub"
              href={`/shop/${hubSlug}`}
              linkLabelKey={
                items.length > preview.length ? "shop.viewAllCount" : "home.viewAll"
              }
              linkLabelVars={
                items.length > preview.length ? { count: items.length } : undefined
              }
            />
            <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
              {preview.map((p) => (
                <ProductCard key={p.code} product={p} />
              ))}
            </div>
          </section>
        ) : (
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
        )}

        {otherHubs.length ? <OtherHubsNav hubs={otherHubs.map((c) => c.slug)} /> : null}
      </div>
    </div>
  );
}
