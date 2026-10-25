import { NextResponse } from "next/server";
import { getStorefrontNav } from "@/lib/supabase/catalog";

export const runtime = "nodejs";

export async function GET() {
  const nav = await getStorefrontNav();
  return NextResponse.json(nav, {
    headers: {
      "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
    },
  });
}
