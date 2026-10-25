import { NextResponse } from "next/server";
import { totalStock } from "@/lib/product-stock";
import { getFreshCheckoutProducts } from "@/lib/supabase/catalog";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get("codes") ?? "";
  const codes = [...new Set(raw.split(",").map((code) => code.trim()).filter(Boolean))].slice(0, 50);
  if (!codes.length) {
    return NextResponse.json({ stock: {} }, { headers: { "Cache-Control": "no-store" } });
  }

  const products = await getFreshCheckoutProducts(codes);
  const stock = Object.fromEntries(
    codes.map((code) => {
      const product = products.get(code);
      if (!product) return [code, { available: false, sizes: [] }];
      const count = totalStock(product);
      const sizes =
        product.sizes?.length > 0
          ? product.sizes
          : [{ size: "SKU", stock: Math.max(0, product.stockQty ?? product.totalQty ?? 0) }];
      return [
        code,
        {
          available: product.available !== false && count > 0,
          sizes,
        },
      ];
    }),
  );

  return NextResponse.json({ stock }, { headers: { "Cache-Control": "no-store" } });
}
