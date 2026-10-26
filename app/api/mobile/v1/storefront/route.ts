import { NextResponse } from "next/server";
import { storefrontResult } from "@/lib/mobile-feed";
import { readMobileStorefront } from "@/lib/mobile-feed-data";
import { cacheHeaders, enforceMobileRateLimit, methodNotAllowed } from "@/lib/mobile-feed-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
 * A missing `v`, or a `v` equal to the current version, is cacheable.
 * A valid `v` that is not the current version returns the memoized current feed
 * with no-store. An invalid `v` is a 400 whose body does not contain the supplied text.
 * A valid `v` is not copied into the JSON or into any response header.
 */
export async function GET(request: Request) {
  const limited = await enforceMobileRateLimit(request, "storefront");
  if (limited) return limited;
  const values = new URL(request.url).searchParams.getAll("v");
  const result = await storefrontResult(values, () => readMobileStorefront());
  if (result.status === 400) {
    return NextResponse.json(
      { error: "Invalid version." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
  return NextResponse.json(result.body, { headers: cacheHeaders(result.cacheControl) });
}
