import { NextResponse } from "next/server";
import { DPO_TEST_CODE, isDpoTestCheckoutEnabled } from "@/lib/dpo-test-product";
import { getCatalog } from "@/lib/supabase/catalog";

export const runtime = "nodejs";

export async function GET() {
  const catalog = await getCatalog();
  return NextResponse.json(
    catalog.filter(
      (p) => p.available !== false || (isDpoTestCheckoutEnabled() && p.code === DPO_TEST_CODE),
    ),
    {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    },
  );
}
