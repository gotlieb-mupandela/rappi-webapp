import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { sendLateOrdersDigest } from "@/lib/order-notify";

/**
 * Daily (Vercel cron, 05:00 UTC = 07:00 Windhoek): emails staff the open orders
 * that are past, or due on, the delivery date promised to the customer.
 * Sends nothing when no order needs chasing.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

function authorized(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = req.headers.get("authorization") ?? "";
  const a = createHash("sha256").update(given).digest();
  const b = createHash("sha256").update(`Bearer ${secret}`).digest();
  return timingSafeEqual(a, b);
}

async function run(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }
  try {
    const result = await sendLateOrdersDigest();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("order watchdog", err);
    return NextResponse.json({ error: "Watchdog failed." }, { status: 500 });
  }
}

export const GET = run;
export const POST = run;
