import { HomeHero } from "@/components/home-hero";
import { HUB_COVERS } from "@/lib/hubs";
import { productForPin } from "@/lib/tile-covers";

export const revalidate = 21600;

/** Homepage is hero-only — no featured / shop-by sections below. */
export default async function HomePage() {
  return (
    <HomeHero
      sportswearCover={HUB_COVERS.sportswear}
      shoesCover={HUB_COVERS.shoes}
      lifestyleProduct={productForPin("home:lifestyle") ?? undefined}
      runningCover={HUB_COVERS["running-fitness"]}
      kidsProduct={productForPin("home:kids") ?? undefined}
      kidsHref="/shop/kids"
    />
  );
}
