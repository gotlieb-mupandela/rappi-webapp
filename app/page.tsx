import { HomeHero } from "@/components/home-hero";
import { HomeSportTile } from "@/components/home-sport-tile";
import { HomeTeamwear } from "@/components/home-teamwear";
import { HubTile } from "@/components/hub-tile";
import { ProductCard } from "@/components/product-card";
import { SectionHeading } from "@/components/section-heading";
import { sampleForCategory, hasUsableProductImage } from "@/lib/classify";
import {
  audienceTiles,
  HOME_CATEGORY_HUBS,
  HOME_SPORTS,
  HUB_COVERS,
} from "@/lib/hubs";
import { getProductByCode, productsInHub } from "@/lib/offline-catalog";
import { getCatalog, getSiteSettings } from "@/lib/supabase/catalog";
import type { Product } from "@/lib/types";

export const revalidate = 3600;

export default async function HomePage() {
  const [catalog, settings] = await Promise.all([getCatalog(), getSiteSettings()]);
  const byCode = (code: string) => getProductByCode(code);
  const spotlightCodes = settings?.spotlight_codes?.length
    ? settings.spotlight_codes
    : ["104409.484", "TOJS2604TF", "RR300W2680", "C448S2715"];
  const spotlight = spotlightCodes
    .map((code) => byCode(code))
    .filter((p): p is Product => p != null)
    .filter(hasUsableProductImage);
  const audiences = audienceTiles(catalog);
  const football = productsInHub("football").filter(hasUsableProductImage);
  const featured = spotlight.length ? spotlight : football.slice(0, 6);
  const categoryHubs = HOME_CATEGORY_HUBS.map((slug) => ({
    slug,
    product: sampleForCategory(catalog, slug),
    imageSrc: HUB_COVERS[slug],
  }));
  const sports = HOME_SPORTS.filter((slug) => sampleForCategory(catalog, slug));

  return (
    <div>
      <HomeHero
        settingsTagline={settings?.tagline}
        settingsTitle={settings?.hero_title}
        settingsBody={settings?.hero_body}
      />

      <section className="page-shell py-12 lg:py-16">
        <SectionHeading
          eyebrow="01"
          titleKey="home.shopBySport"
          href="/search"
          linkLabelKey="home.browseAll"
        />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:gap-4">
          {sports.map((slug, i) => (
            <HomeSportTile
              key={slug}
              slug={slug}
              product={sampleForCategory(catalog, slug)}
              imageSrc={HUB_COVERS[slug]}
              priority={i < 4}
            />
          ))}
        </div>
      </section>

      <section className="page-shell pb-12 lg:pb-16">
        <SectionHeading
          eyebrow="02"
          titleKey="home.featuredTitle"
          href="/shop/sportswear"
          linkLabelKey="home.viewAll"
        />
        <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {featured.map((p) => (
            <ProductCard key={p.code} product={p} />
          ))}
        </div>
      </section>

      <HomeTeamwear />

      <section className="page-shell py-12 lg:py-16">
        <SectionHeading
          eyebrow="03"
          titleKey="home.shopByCategory"
          href="/shop/men"
          linkLabelKey="home.shopMen"
        />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4">
          {audiences.map((a) => (
            <HubTile
              key={a.key}
              slug={a.sample?.category ?? "sportswear"}
              nameAudience={a.key}
              href={a.href}
              product={a.sample}
              imageSrc={a.cover}
              shape="square"
              imageFit={a.cover ? "contain" : "cover"}
              priority
            />
          ))}
          {categoryHubs.map((hub) => (
            <HubTile
              key={hub.slug}
              slug={hub.slug}
              nameHub={hub.slug === "balls-bags" ? undefined : hub.slug}
              nameKey={hub.slug === "balls-bags" ? "home.equipment" : undefined}
              href={`/shop/${hub.slug}`}
              product={hub.product}
              imageSrc={hub.imageSrc}
              shape="square"
              imageFit={hub.imageSrc ? "contain" : "cover"}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
