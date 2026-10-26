import { NextResponse } from "next/server";
import { buildMobileStorefront } from "@/lib/mobile-storefront";
import { canonicalSlug } from "@/lib/slug-aliases";

export const runtime = "nodejs";
export const revalidate = 300;

const CACHE = "public, s-maxage=300, stale-while-revalidate=86400";

function withCanonicalKeys(tiles: Record<string, string>) {
  return Object.fromEntries(Object.entries(tiles).map(([key, url]) => [canonicalSlug(key), url]));
}

export async function GET() {
  const data = await buildMobileStorefront();
  data.homeTiles = withCanonicalKeys(data.homeTiles);
  data.hubCovers = withCanonicalKeys(data.hubCovers);
  for (const menu of Object.values(data.menus)) {
    menu.tiles = withCanonicalKeys(menu.tiles);
  }
  return NextResponse.json(data, {
    headers: {
      "Cache-Control": CACHE,
      "CDN-Cache-Control": CACHE,
    },
  });
}
