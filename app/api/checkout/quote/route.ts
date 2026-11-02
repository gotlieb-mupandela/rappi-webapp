import { NextResponse } from "next/server";
import { enforceCheckoutRateLimit, pricedCartError } from "@/lib/checkout-http";
import { parseShippingMethod } from "@/lib/checkout-lines";
import { checkoutPaymentQuote, resolveCheckoutCountry } from "@/lib/checkout-quote";
import { discountRouteError } from "@/lib/discount";
import { resolveActiveDiscount } from "@/lib/discount-lookup";
import { resolveCheckoutLines } from "@/lib/dpo-cart";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const blocked = await enforceCheckoutRateLimit(req, "checkout-quote");
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

  const record = body as {
    shippingMethod?: unknown;
    country?: unknown;
    lines?: unknown;
    discountCode?: unknown;
  };
  const shippingMethod = parseShippingMethod(record.shippingMethod);
  if (!shippingMethod) {
    return NextResponse.json({ error: "Choose a shipping method." }, { status: 400 });
  }
  const vatCountry = resolveCheckoutCountry(record.country, shippingMethod);
  if (!vatCountry) {
    return NextResponse.json({ error: "Choose a country." }, { status: 400 });
  }

  try {
    const [discount, lines] = await Promise.all([
      resolveActiveDiscount(record.discountCode),
      resolveCheckoutLines(record.lines),
    ]);
    const quote = checkoutPaymentQuote(lines, shippingMethod, vatCountry.name, undefined, discount);
    return NextResponse.json(quote, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    const discountError = discountRouteError(err);
    if (discountError) {
      return NextResponse.json({ error: discountError.error }, { status: discountError.status });
    }
    return pricedCartError(err);
  }
}
