import { HomeHero } from "@/components/home-hero";
import { HUB_COVERS } from "@/lib/hubs";

export const revalidate = 3600;

// Homepage tiles render static local covers (HUB_COVERS) — no catalog scan.
// Loading the 11k-row catalog here cost ~6s of server time for zero
// rendered pixels (HubTile prefers imageSrc over the product photo).
export default async function HomePage() {
  return (
    <HomeHero
      sportswearCover={HUB_COVERS.sportswear}
      shoesCover={HUB_COVERS.shoes}
      lifestyleCover={HUB_COVERS.lifestyle}
      runningCover={HUB_COVERS["running-fitness"] ?? HUB_COVERS.rugby}
      kidsCover={HUB_COVERS.kids ?? HUB_COVERS.lifestyle}
      kidsHref="/shop/kids"
    />
  );
}
