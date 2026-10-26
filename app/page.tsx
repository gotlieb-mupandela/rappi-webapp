import { HomeHero } from "@/components/home-hero";
import { HUB_COVERS } from "@/lib/hubs";
import { toClientProduct } from "@/lib/listing-core";
import { pinnedTileImageUrl, productForPin } from "@/lib/tile-covers";

export const revalidate = 21600;

/** Homepage is hero-only — no featured / shop-by sections below. */
export default async function HomePage() {
  const running = productForPin("home:running");
  const lifestyle = productForPin("home:lifestyle");
  const kids = productForPin("home:kids");
  const runningProduct = running ? toClientProduct(running) : undefined;
  return (
    <HomeHero
      sportswearCover={HUB_COVERS.sportswear}
      shoesCover={HUB_COVERS.shoes}
      lifestyleProduct={lifestyle ? toClientProduct(lifestyle) : undefined}
      runningProduct={runningProduct}
      runningCover={runningProduct ? undefined : HUB_COVERS["running-fitness"]}
      kidsProduct={kids ? toClientProduct(kids) : undefined}
      kidsCover={pinnedTileImageUrl("home:kids") || undefined}
      kidsHref="/shop/kids"
    />
  );
}
