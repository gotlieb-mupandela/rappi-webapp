import { NextResponse } from "next/server";
import { catalogVersion } from "@/lib/catalog-version";
import { buildMobileStorefront } from "@/lib/mobile-storefront";
import { getCatalogLive } from "@/lib/supabase/catalog";

export const runtime = "nodejs";
export const revalidate = 300;

const CACHE = "public, s-maxage=300, stale-while-revalidate=86400";

export async function GET() {
  const [data, catalog] = await Promise.all([buildMobileStorefront(), getCatalogLive()]);
  return NextResponse.json({ ...data, version: catalogVersion(catalog) }, {
    headers: {
      "Cache-Control": CACHE,
      "CDN-Cache-Control": CACHE,
    },
  });
}
