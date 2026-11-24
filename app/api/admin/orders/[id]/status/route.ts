import { NextResponse } from "next/server";
import { isOrderStatus } from "@/lib/order-status";
import { emailKindForStatus, notifyOrder, type NotifyResult } from "@/lib/order-notify";
import { orderPushPayload, sendPushToUser } from "@/lib/push";
import { createRequestClient } from "@/lib/supabase/request";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

function clip(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

/**
 * Admin changes an order's status. The status change itself goes through the
 * set_order_status RPC (which checks is_admin); the customer is then emailed once
 * per status and gets a push notification if they enabled them.
 */
export async function POST(req: Request, context: RouteContext) {
  const supabase = await createRequestClient(req);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const { id } = await context.params;
  let body: { status?: unknown; courier?: unknown; tracking?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const status = typeof body.status === "string" ? body.status : "";
  if (!isOrderStatus(status)) {
    return NextResponse.json({ error: "Unknown status." }, { status: 400 });
  }

  const { data: before } = await supabase.from("orders").select("status").eq("id", id).maybeSingle();

  const { data: order, error } = await supabase.rpc("set_order_status", {
    p_order_id: id,
    p_status: status,
    p_courier: clip(body.courier, 80) || undefined,
    p_tracking: clip(body.tracking, 80) || undefined,
  });
  if (error || !order) {
    const message = error?.message ?? "Could not update the order.";
    const code = /not authorized/i.test(message) ? 403 : /not found/i.test(message) ? 404 : 400;
    return NextResponse.json({ error: message }, { status: code });
  }

  let email: NotifyResult | { sent: false; skipped: "no_email_for_status" | "unchanged" } = {
    sent: false,
    skipped: "no_email_for_status",
  };
  const kind = emailKindForStatus(status);
  if (before?.status === status) {
    email = { sent: false, skipped: "unchanged" };
  } else if (kind) {
    email = await notifyOrder(id, kind);
  }

  if (before?.status !== status && order.user_id) {
    try {
      await sendPushToUser(order.user_id, orderPushPayload({ orderId: id, status, country: order.country }));
    } catch (err) {
      console.error("order status push", err);
    }
  }

  return NextResponse.json({ order, email });
}
