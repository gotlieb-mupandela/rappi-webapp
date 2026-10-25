import "server-only";

import { NextResponse } from "next/server";
import { CartResolveError } from "@/lib/checkout-lines";
import { escapeHtml } from "@/lib/html-escape";
import { consumeRateLimit, requestIp } from "@/lib/rate-limit";

const QUOTE_LIMIT = 60;
const QUOTE_WINDOW_SECONDS = 60;

/** Existing consume_rate_limit RPC. No new table and no new env var. */
export async function enforceCheckoutRateLimit(req: Request, bucket: string) {
  try {
    const allowed = await consumeRateLimit(
      `${bucket}:${requestIp(req)}`,
      QUOTE_LIMIT,
      QUOTE_WINDOW_SECONDS,
    );
    if (!allowed) {
      return NextResponse.json({ error: "Too many requests. Try again later." }, { status: 429 });
    }
  } catch (err) {
    console.error("checkout rate limit", err instanceof Error ? err.message : "failed");
    return NextResponse.json({ error: "Too many requests. Try again later." }, { status: 429 });
  }
  return null;
}

/** Error body for the read-only pricing routes. User-controlled text is escaped. */
export function pricedCartError(err: unknown) {
  if (err instanceof CartResolveError) {
    return NextResponse.json({ error: escapeHtml(err.message) }, { status: err.status });
  }
  return NextResponse.json({ error: "Could not price the cart." }, { status: 400 });
}
