import { NextResponse } from "next/server";
import { totalStock } from "@/lib/product-stock";
import { lookupStockCodes, parseStockCodes } from "@/lib/stock-codes";
import { getFreshCheckoutProducts } from "@/lib/supabase/catalog";
import type { Product } from "@/lib/types";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const parsed = parseStockCodes(new URL(request.url).searchParams);
  if (!parsed.codes.length) {
    return NextResponse.json({ stock: {} }, { headers: { "Cache-Control": "no-store" } });
  }

  const lookup = lookupStockCodes(parsed);
  const products: Map<string, Product> = lookup.length
    ? await getFreshCheckoutProducts(lookup)
    : new Map();
  const overLength = new Set(parsed.overLength);
  const stock = Object.fromEntries(
    parsed.codes.map((code) => {
      if (overLength.has(code)) return [code, { available: false, sizes: [] }];
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
