import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { sendOpeningReminders } from "@/lib/opening-emails";
import { sendLateOrdersDigest } from "@/lib/order-notify";

/**
 * Daily (Vercel cron, 05:00 UTC = 07:00 Windhoek): emails staff the open orders
 * that are past, or due on, the delivery date promised to the customer.
 * Sends nothing when no order needs chasing.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

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
  // Store-opening reminder emails ride on this daily job (the plan allows only two cron jobs).
  let opening: Awaited<ReturnType<typeof sendOpeningReminders>> | { error: string };
  try {
    opening = await sendOpeningReminders();
  } catch (err) {
    console.error("opening reminders", err);
    opening = { error: "Opening reminders failed." };
  }
  try {
    const result = await sendLateOrdersDigest();
    return NextResponse.json({ ok: true, ...result, opening });
  } catch (err) {
    console.error("order watchdog", err);
    return NextResponse.json({ error: "Watchdog failed.", opening }, { status: 500 });
  }
}

export const GET = run;
export const POST = run;
