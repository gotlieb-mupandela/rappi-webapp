import { HomeHero } from "@/components/home-hero";
import { sampleForCategory } from "@/lib/classify";
import { audienceTiles, HUB_COVERS } from "@/lib/hubs";
import { getCatalog } from "@/lib/supabase/catalog";

export const revalidate = 3600;

export default async function HomePage() {
  const catalog = await getCatalog();
  const audiences = audienceTiles(catalog);
  const kidsAudience = audiences.find((a) => a.key === "kids");

  return (
    <HomeHero
      sportswearCover={HUB_COVERS.sportswear}
      sportswearProduct={sampleForCategory(catalog, "sportswear")}
      shoesCover={HUB_COVERS.shoes}
      shoesProduct={sampleForCategory(catalog, "shoes")}
      lifestyleCover={HUB_COVERS.lifestyle}
      lifestyleProduct={sampleForCategory(catalog, "lifestyle")}
      runningCover={HUB_COVERS["running-fitness"] ?? HUB_COVERS.rugby}
      runningProduct={sampleForCategory(catalog, "running-fitness")}
      kidsCover={kidsAudience?.cover ?? HUB_COVERS.kids ?? HUB_COVERS.lifestyle}
      kidsProduct={kidsAudience?.sample}
      kidsHref={kidsAudience?.href ?? "/shop/kids"}
    />
  );
}
