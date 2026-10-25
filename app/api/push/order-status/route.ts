import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { isOrderStatus } from "@/lib/order-status";
import { orderPushPayload, sendPushToUser } from "@/lib/push";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

function secretsMatch(provided: string, expected: string) {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

function authorized(req: Request) {
  const expected = process.env.PUSH_WEBHOOK_SECRET;
  if (!expected) return false;
  const header = req.headers.get("authorization") ?? "";
  const bearer = header.startsWith("Bearer ") ? header.slice(7) : "";
  const custom = req.headers.get("x-push-secret") ?? "";
  return secretsMatch(bearer, expected) || secretsMatch(custom, expected);
}

type WebhookBody = {
  type?: string;
  record?: Record<string, unknown>;
  old_record?: Record<string, unknown>;
  orderId?: string;
  status?: string;
};

export async function POST(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let body: WebhookBody;
  try {
    body = (await req.json()) as WebhookBody;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const record = body.record ?? {};
  const previous = body.old_record ?? {};
  const orderId = String(body.orderId ?? record.id ?? "").trim();
  const status = String(body.status ?? record.status ?? "").trim();
  const previousStatus = String(previous.status ?? "").trim();

  if (!orderId || !isOrderStatus(status)) {
    return NextResponse.json({ error: "Missing order status." }, { status: 400 });
  }
  if (previousStatus && previousStatus === status) {
    return NextResponse.json({ ok: true, skipped: "unchanged" });
  }

  const admin = createAdminClient();
  const { data: order, error } = await admin
    .from("orders")
    .select("id, user_id, country, status")
    .eq("id", orderId)
    .maybeSingle();
  if (error) {
    console.error("push order lookup", error.message);
    return NextResponse.json({ error: "Order lookup failed." }, { status: 500 });
  }
  if (!order?.user_id) {
    return NextResponse.json({ ok: true, skipped: "no-user" });
  }

  try {
    const result = await sendPushToUser(
      order.user_id,
      orderPushPayload({
        orderId: order.id,
        status: order.status,
        country: order.country,
      }),
    );
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("push order send", err);
    return NextResponse.json({ error: "Send failed." }, { status: 500 });
  }
}
