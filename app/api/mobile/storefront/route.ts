import { NextResponse } from "next/server";
import { catalogVersion } from "@/lib/catalog-version";
import { buildStorefrontCovers } from "@/lib/mobile-storefront";
import { canonicalSlug } from "@/lib/slug-aliases";
import { getCatalogLive } from "@/lib/supabase/catalog";

export const runtime = "nodejs";
export const revalidate = 300;

const CACHE = "public, s-maxage=300, stale-while-revalidate=86400";

function withCanonicalKeys(tiles: Record<string, string>) {
  return Object.fromEntries(Object.entries(tiles).map(([key, url]) => [canonicalSlug(key), url]));
}

export async function GET() {
  const [data, catalog] = await Promise.all([buildStorefrontCovers(), getCatalogLive()]);
  data.homeTiles = withCanonicalKeys(data.homeTiles);
  data.hubCovers = withCanonicalKeys(data.hubCovers);
  for (const menu of Object.values(data.menus)) {
    menu.tiles = withCanonicalKeys(menu.tiles);
  }
  return NextResponse.json({ ...data, version: catalogVersion(catalog) }, {
    headers: {
      "Cache-Control": CACHE,
      "CDN-Cache-Control": CACHE,
    },
  });
}
