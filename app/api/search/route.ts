import { NextResponse } from "next/server";
import { getAssortment } from "@/lib/assortment";
import { buildListing, LISTING_PAGE_SIZE } from "@/lib/listing-core";
import { isSoldOut } from "@/lib/product-stock";
import { getCatalog } from "@/lib/supabase/catalog";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const catalog = await getCatalog();
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
      total: listing.total,
      page: listing.page,
      pageSize: listing.pageSize ?? LISTING_PAGE_SIZE,
      pageCount: listing.pageCount,
      facets: listing.facets,
      items: listing.products.map((p) => ({
        code: p.code,
        displayName: p.displayName,
        name: p.name,
        category: p.category,
        subcategory: p.subcategory,
        price: p.price,
        imageUrl: p.imageUrl,
        available: !isSoldOut(p),
        assortment: getAssortment(p)?.label ?? null,
      })),
    },
    {
      headers: {
        // CDN cache for leftover typeahead / bot hits. Browse uses the client listing index.
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      },
    },
  );
}
