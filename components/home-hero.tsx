"use client";

import { HubTile } from "@/components/hub-tile";
import { useT } from "@/components/locale-provider";
import { homeTileLayout } from "@/lib/home-tiles";
import { hubNav } from "@/lib/i18n/labels";
import type { Product } from "@/lib/types";

const TEAMWEAR_COVER = "/brand/hub-teampro-2026.webp";

export function HomeHero({
  sportswearCover,
  sportswearProduct,
  shoesCover,
  shoesProduct,
  lifestyleCover,
  lifestyleProduct,
  runningCover,
  runningProduct,
  kidsCover,
  kidsProduct,
  kidsHref = "/shop/kids",
}: {
  sportswearCover?: string;
  sportswearProduct?: Product;
  shoesCover?: string;
  shoesProduct?: Product;
  lifestyleCover?: string;
  lifestyleProduct?: Product;
  runningCover?: string;
  runningProduct?: Product;
  kidsCover?: string;
  kidsProduct?: Product;
  kidsHref?: string;
}) {
  const t = useT();
  const teamwear = homeTileLayout("teamwear");
  const sportswear = homeTileLayout("sportswear");
  const running = homeTileLayout("running");
  const lifestyle = homeTileLayout("lifestyle");
  const footwear = homeTileLayout("footwear");
  const kids = homeTileLayout("kids");

  return (
    <section className="bg-white">
      <div className="page-shell py-3 sm:py-4 lg:flex lg:h-[calc(100dvh-var(--header-h)-env(safe-area-inset-top))] lg:flex-col lg:py-5">
        <h1 className="sr-only">{t("home.title")}</h1>
        {/*
          Joma-style 2×4 bento:
          [ teamwear 2 ] [ sport 1 ] [ run 1 ]
          [ life 1 ] [ shoes 1 ] [ kids 2 ]
          Equal row heights; every tile fills with object-cover.
        */}
        <div className="grid min-h-0 flex-1 grid-cols-2 grid-rows-[minmax(11rem,1fr)_minmax(11rem,1fr)] gap-2 sm:gap-2.5 md:grid-cols-4 md:grid-rows-2 md:gap-3 lg:gap-3.5">
          <HubTile
            slug="teampro-2026"
            name={t("home.teamwearEyebrow")}
            href="/teamwear"
            imageSrc={TEAMWEAR_COVER}
            size="large"
            fill
            imageFit="cover"
            imagePosition="object-center"
            showLabel
            priority
            className={teamwear.className}
          />

          <HubTile
            slug="sportswear"
            name={hubNav("sportswear", t)}
            href="/category/sportswear"
            product={sportswearProduct}
            imageSrc={sportswearCover}
            size="medium"
            fill
            imageFit="cover"
            imagePosition="object-top"
            className={sportswear.className}
          />

          <HubTile
            slug="running-fitness"
            name={hubNav("running-fitness", t)}
            href="/category/running-fitness"
            product={runningProduct}
            imageSrc={runningCover}
            size="medium"
            fill
            imageFit="cover"
            imagePosition="object-[center_20%]"
            className={running.className}
          />

          <HubTile
            slug="lifestyle"
            nameHub="lifestyle"
            href="/category/lifestyle"
            product={lifestyleProduct}
            imageSrc={lifestyleCover}
            size="medium"
            fill
            imageFit="cover"
            imagePosition="object-center"
            className={lifestyle.className}
          />

          <HubTile
            slug="shoes"
            nameHub="shoes"
            href="/category/shoes"
            product={shoesProduct}
            imageSrc={shoesCover}
            size="medium"
            fill
            imageFit="cover"
            imagePosition="object-center"
            className={footwear.className}
          />

          <HubTile
            slug="kids"
            nameAudience="kids"
            href={kidsHref}
            product={kidsProduct}
            imageSrc={kidsCover}
            size="large"
            fill
            tone={kids.tone}
            labelPosition="center"
            imageFit="cover"
            imagePosition="object-center"
            className={kids.className}
          />
        </div>
      </div>
    </section>
  );
}
