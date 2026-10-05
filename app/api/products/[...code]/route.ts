import { NextResponse } from "next/server";
import { toClientProduct } from "@/lib/listing-core";
import { getProduct } from "@/lib/products";
import { getCatalog } from "@/lib/supabase/catalog";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ code: string[] }> };

export async function GET(_request: Request, context: RouteContext) {
  const { code: parts } = await context.params;
  const code = parts.join("/").trim();
  const product = code ? getProduct(code, await getCatalog()) : undefined;

  if (!product || product.available === false) {
    return NextResponse.json({ error: "Product not found." }, { status: 404 });
  }

  return NextResponse.json(toClientProduct(product), {
    headers: {
      "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
    },
  });
}
