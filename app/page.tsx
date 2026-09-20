import { HomeHero } from "@/components/home-hero";
import { HubTile } from "@/components/hub-tile";
import { ProductCard } from "@/components/product-card";
import { SectionHeading } from "@/components/section-heading";
import { CATEGORIES } from "@/lib/catalog";
import { sampleForCategory, hasUsableProductImage } from "@/lib/classify";
import { audienceTiles, collectionTiles, HUB_COVERS } from "@/lib/hubs";
import { categoryCountsFrom } from "@/lib/products";
import { getProductByCode, productsInHub } from "@/lib/offline-catalog";
import { getCatalog, getSiteSettings } from "@/lib/supabase/catalog";
import type { Product } from "@/lib/types";
import { cn } from "@/lib/utils";

export const revalidate = 3600;

export default async function HomePage() {
  const [catalog, settings] = await Promise.all([getCatalog(), getSiteSettings()]);
  const byCode = (code: string) => getProductByCode(code);
  const counts = categoryCountsFrom(catalog);
  const hubs = CATEGORIES.filter((c) => sampleForCategory(catalog, c.slug));
  const spotlightCodes = settings?.spotlight_codes?.length
    ? settings.spotlight_codes
    : ["104409.484", "TOJS2604TF", "RR300W2680", "C448S2715"];
  const spotlight = spotlightCodes
    .map((code) => byCode(code))
    .filter((p): p is Product => Boolean(p) && hasUsableProductImage(p));
  const collections = collectionTiles(catalog);
  const audiences = audienceTiles(catalog);
  const football = productsInHub("football").filter(hasUsableProductImage);

  return (
    <div>
      <HomeHero
        catalogCount={catalog.length}
        settingsTagline={settings?.tagline}
        settingsTitle={settings?.hero_title}
        settingsBody={settings?.hero_body}
      />

      <section className="page-shell py-12 lg:py-16">
        <SectionHeading
          eyebrow="01"
          titleKey="home.audiencesTitle"
          href="/shop/men"
          linkLabelKey="home.shopMen"
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 md:gap-4">
          {audiences.map((a) => (
            <HubTile
              key={a.key}
              slug={a.sample?.category ?? "sportswear"}
              nameAudience={a.key}
              count={a.count}
              href={a.href}
              product={a.sample}
              imageSrc={a.cover}
              shape="square"
              imageFit={a.cover ? "contain" : "cover"}
              priority
            />
          ))}
        </div>
      </section>

      <section className="page-shell pb-12 lg:pb-16">
        <SectionHeading
          eyebrow="02"
          titleKey="home.shopTitle"
          href="/search"
          linkLabelKey="home.browseAll"
        />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:auto-rows-[minmax(15rem,auto)] md:gap-4">
          {hubs.map((c, i) => (
            <div
              key={c.slug}
              className={cn(
                i === 0 && "col-span-2 h-full md:row-span-2",
                i === 0 &&
                  c.slug === "sportswear" &&
                  "min-h-[18rem] sm:min-h-[24rem] md:min-h-[34rem]",
              )}
            >
              <HubTile
                slug={c.slug}
                nameHub={c.slug}
                count={counts[c.slug]}
                product={sampleForCategory(catalog, c.slug)}
                imageSrc={HUB_COVERS[c.slug]}
                fill={i === 0}
                shape={i === 0 ? "portrait" : "square"}
                compact={i !== 0}
                imageFit={
                  (c.slug === "sportswear" ||
                    c.slug === "shoes" ||
                    c.slug === "lifestyle" ||
                    c.slug === "teampro-2026" ||
                    c.slug === "rugby") &&
                  HUB_COVERS[c.slug]
                    ? "contain"
                    : "cover"
                }
                priority={i < 5}
              />
            </div>
          ))}
        </div>
      </section>

      <section className="page-shell pb-12 lg:pb-16">
        <SectionHeading
          eyebrow="03"
          titleKey="home.collectionsTitle"
          href="/promotions"
          linkLabelKey="home.viewAll"
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 md:gap-5">
          {collections.map((c) => (
            <HubTile
              key={c.key}
              slug={c.key}
              nameHub={c.key}
              count={c.count}
              href={c.href}
              product={c.sample}
              shape="square"
              priority={false}
            />
          ))}
        </div>
      </section>

      <section className="page-shell pb-16 lg:pb-20">
        <SectionHeading
          eyebrow="04"
          titleKey="home.nowIn"
          href="/shop/sportswear"
          linkLabelKey="home.viewAll"
        />
        <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {(spotlight.length ? spotlight : football.slice(0, 6)).map((p) => (
            <ProductCard key={p.code} product={p} />
          ))}
        </div>
      </section>
    </div>
  );
}
