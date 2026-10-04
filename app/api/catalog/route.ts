import { NextResponse } from "next/server";
import { buildListing, LISTING_PAGE_SIZE, toClientProduct } from "@/lib/listing-core";
import { getCatalog } from "@/lib/supabase/catalog";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const catalog = await getCatalog();
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
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    },
  );
}
