import { HomeHero } from "@/components/home-hero";
import { HUB_COVERS } from "@/lib/hubs";
import { coverUrlForKey } from "@/lib/tile-covers";

export const revalidate = 3600;

/** Homepage is hero-only — no featured / shop-by sections below. */
export default async function HomePage() {
  return (
    <HomeHero
      sportswearCover={HUB_COVERS.sportswear}
      shoesCover={HUB_COVERS.shoes}
      lifestyleCover={coverUrlForKey("home:lifestyle")}
      runningCover={HUB_COVERS["running-fitness"]}
      kidsCover={coverUrlForKey("home:kids")}
      kidsHref="/shop/kids"
    />
  );
}
