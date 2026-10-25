import { NextResponse } from "next/server";
import { enforceCheckoutRateLimit, pricedCartError } from "@/lib/checkout-http";
import { bagPrices } from "@/lib/checkout-quote";
import { resolveCheckoutLines } from "@/lib/dpo-cart";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const blocked = await enforceCheckoutRateLimit(req, "cart-prices");
  if (blocked) return blocked;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const record = body as { lines?: unknown };
  try {
    const lines = await resolveCheckoutLines(record.lines);
    return NextResponse.json(bagPrices(lines), { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return pricedCartError(err);
  }
}
