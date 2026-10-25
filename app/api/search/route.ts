import { NextResponse } from "next/server";
import { buildListing, LISTING_PAGE_SIZE, toClientProduct } from "@/lib/listing-core";
import { getCatalogLive } from "@/lib/supabase/catalog";

export const revalidate = 3600;

const SEARCH_CACHE = "public, s-maxage=3600, stale-while-revalidate=86400";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const catalog = await getCatalogLive();
  const listing = buildListing(
    catalog,
    {
      q,
      cat: url.searchParams.get("cat") ?? undefined,
      sub: url.searchParams.get("sub") ?? undefined,
      group: url.searchParams.get("group") ?? undefined,
      size: url.searchParams.get("size") ?? undefined,
      max: url.searchParams.get("max") ?? undefined,
      audience: url.searchParams.get("audience") ?? undefined,
      page: url.searchParams.get("page") ?? undefined,
    },
    { requireQuery: true },
  );

  return NextResponse.json(
    {
      q,
      listing: {
        ...listing,
        products: listing.products.map(toClientProduct),
        pageSize: listing.pageSize ?? LISTING_PAGE_SIZE,
      },
    },
    {
      headers: {
        "Cache-Control": SEARCH_CACHE,
        "CDN-Cache-Control": SEARCH_CACHE,
      },
    },
  );
}
