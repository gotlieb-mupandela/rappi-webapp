import { NextResponse } from "next/server";
import { readMobileStorefront } from "@/lib/mobile-feed-data";
import { cacheHeaders, enforceMobileRateLimit, methodNotAllowed } from "@/lib/mobile-feed-http";
import { feedVersionParamStatus } from "@/lib/mobile-feed-version";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CACHE = "public, s-maxage=300, stale-while-revalidate=86400";

export function POST() {
  return methodNotAllowed();
}
export function PUT() {
  return methodNotAllowed();
}
export function PATCH() {
  return methodNotAllowed();
}
export function DELETE() {
  return methodNotAllowed();
}
export function HEAD() {
  return methodNotAllowed();
}
export function OPTIONS() {
  return methodNotAllowed();
}

/**
 * `v` selects a CDN cache entry only. A missing `v` still returns the current feed.
 * An invalid `v` is a 400 whose body does not contain the supplied text.
 * A valid `v` is not copied into the JSON or into any response header.
 */
export async function GET(request: Request) {
  const limited = await enforceMobileRateLimit(request, "storefront");
  if (limited) return limited;
  const values = new URL(request.url).searchParams.getAll("v");
  if (feedVersionParamStatus(values) === "invalid") {
    return NextResponse.json(
      { error: "Invalid version." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
  const feed = await readMobileStorefront();
  return NextResponse.json(feed, { headers: cacheHeaders(CACHE) });
}
