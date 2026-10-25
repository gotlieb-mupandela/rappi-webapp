import { NextResponse } from "next/server";
import { buildListing, LISTING_PAGE_SIZE, toClientProduct } from "@/lib/listing-core";
import { getCatalogLive } from "@/lib/supabase/catalog";

export const runtime = "nodejs";
export const revalidate = 3600;

const LISTING_CACHE = "public, s-maxage=3600, stale-while-revalidate=86400";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const catalog = await getCatalogLive();
  const listing = buildListing(
    catalog,
    {
      q: url.searchParams.get("q") ?? undefined,
      cat: url.searchParams.get("cat") ?? url.searchParams.get("category") ?? undefined,
      sub: url.searchParams.get("sub") ?? undefined,
      group: url.searchParams.get("group") ?? undefined,
      size: url.searchParams.get("size") ?? undefined,
      max: url.searchParams.get("max") ?? undefined,
      audience: url.searchParams.get("audience") ?? url.searchParams.get("gender") ?? undefined,
      page: url.searchParams.get("page") ?? undefined,
    },
    { pageSize: Number(url.searchParams.get("pageSize")) || LISTING_PAGE_SIZE },
  );

  return NextResponse.json(
    {
      total: listing.total,
      page: listing.page,
      pageSize: listing.pageSize ?? LISTING_PAGE_SIZE,
      pageCount: listing.pageCount,
      facets: listing.facets,
      products: listing.products.map(toClientProduct),
    },
    {
      headers: {
        "Cache-Control": LISTING_CACHE,
        "CDN-Cache-Control": LISTING_CACHE,
      },
    },
  );
}
