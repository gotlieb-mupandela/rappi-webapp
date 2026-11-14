import { NextResponse } from "next/server";
import { STOREFRONT_CACHE } from "@/lib/mobile-feed";
import { getMobileCatalogueVersion } from "@/lib/mobile-feed-data";
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

export async function GET(request: Request) {
  const limited = await enforceMobileRateLimit(request, "version");
  if (limited) return limited;
  const version = await getMobileCatalogueVersion();
  return NextResponse.json({ version }, { headers: cacheHeaders(STOREFRONT_CACHE) });
}
