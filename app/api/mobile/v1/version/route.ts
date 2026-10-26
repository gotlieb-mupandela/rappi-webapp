import { NextResponse } from "next/server";
import { getMobileCatalogueVersion } from "@/lib/mobile-feed-data";
import { cacheHeaders, enforceMobileRateLimit, methodNotAllowed } from "@/lib/mobile-feed-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CACHE = "public, s-maxage=60, stale-while-revalidate=300";

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
  return NextResponse.json({ version }, { headers: cacheHeaders(CACHE) });
}
