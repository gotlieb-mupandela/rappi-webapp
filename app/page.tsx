import { HomeHero } from "@/components/home-hero";
import { HUB_COVERS } from "@/lib/hubs";
import { productForPin } from "@/lib/tile-covers";

export const revalidate = 21600;

/** Homepage is hero-only — no featured / shop-by sections below. */
export default async function HomePage() {
  const runningProduct = productForPin("home:running") ?? undefined;
  return (
    <HomeHero
      sportswearCover={HUB_COVERS.sportswear}
      shoesCover={HUB_COVERS.shoes}
      lifestyleProduct={productForPin("home:lifestyle") ?? undefined}
      runningProduct={runningProduct}
      runningCover={runningProduct ? undefined : HUB_COVERS["running-fitness"]}
      kidsProduct={productForPin("home:kids") ?? undefined}
      kidsHref="/shop/kids"
    />
  );
}
