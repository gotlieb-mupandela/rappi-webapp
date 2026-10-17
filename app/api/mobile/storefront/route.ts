import { NextResponse } from "next/server";
import { buildMobileStorefront } from "@/lib/mobile-storefront";

export const runtime = "nodejs";
export const revalidate = 300;

const CACHE = "public, s-maxage=300, stale-while-revalidate=86400";

export async function GET() {
  const data = await buildMobileStorefront();
  return NextResponse.json(data, {
    headers: {
      "Cache-Control": CACHE,
      "CDN-Cache-Control": CACHE,
    },
  });
}
