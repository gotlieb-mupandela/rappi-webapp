"use client";

import { HubTile } from "@/components/hub-tile";
import { useT } from "@/components/locale-provider";
import { hubNav } from "@/lib/i18n/labels";
import type { Product } from "@/lib/types";

const TEAMWEAR_COVER = "/brand/hub-teampro-2026.png";

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
            className="col-span-2 min-h-[12rem] md:min-h-0"
          />

          <HubTile
            slug="sportswear"
            name={hubNav("sportswear", t)}
            href="/shop/sportswear"
            product={sportswearProduct}
            imageSrc={sportswearCover}
            size="medium"
            fill
            imageFit="cover"
            imagePosition="object-top"
            className="min-h-[12rem] md:min-h-0"
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
            className="min-h-[12rem] md:min-h-0"
          />

          <HubTile
            slug="lifestyle"
            nameHub="lifestyle"
            href="/shop/lifestyle"
            product={lifestyleProduct}
            imageSrc={lifestyleCover}
            size="medium"
            fill
            imageFit="cover"
            imagePosition="object-center"
            className="min-h-[11rem] md:min-h-0"
          />

          <HubTile
            slug="shoes"
            nameHub="shoes"
            href="/shop/shoes"
            product={shoesProduct}
            imageSrc={shoesCover}
            size="medium"
            fill
            imageFit="cover"
            imagePosition="object-center"
            className="min-h-[11rem] md:min-h-0"
          />

          <HubTile
            slug="kids"
            nameAudience="kids"
            href={kidsHref}
            product={kidsProduct}
            imageSrc={kidsCover}
            size="large"
            fill
            tone="light"
            labelPosition="center"
            imageFit="cover"
            imagePosition="object-center"
            className="col-span-2 min-h-[12rem] md:min-h-0"
          />
        </div>
      </div>
    </section>
  );
}
