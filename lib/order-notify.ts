import "server-only";

import { about } from "@/lib/about";
import { invoiceSeller } from "@/lib/invoice-pdf";
import { metaSiteUrl } from "@/lib/meta/site";
import {
  renderLateOrdersDigest,
  renderOrderEmail,
  type LateOrderRow,
  type OrderEmailContext,
  type OrderEmailKind,
} from "@/lib/order-emails";
import { brandLogoUrl, sendEmail } from "@/lib/resend-pdf";
import { contactEmail } from "@/lib/site-contact";
import { createAdminClient } from "@/lib/supabase/admin";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** A claimed send with no result after this long is treated as abandoned and retried. */
const STALE_CLAIM_MS = 5 * 60_000;

/** Who receives staff emails: ORDER_ALERT_EMAILS (comma separated) or the shop contact inbox. */
export function staffRecipients() {
  const list = (process.env.ORDER_ALERT_EMAILS || contactEmail())
    .split(",")
    .map((s) => s.trim())
    .filter((s) => EMAIL.test(s));
  return [...new Set(list)];
}

export function orderEmailBase(): Omit<OrderEmailContext, "order" | "items"> {
  return {
    siteUrl: metaSiteUrl(),
    logoUrl: brandLogoUrl(),
    sellerName: invoiceSeller().legalName,
    contactEmail: contactEmail(),
    contactPhone: about.company.phoneDisplay,
  };
}

export async function loadOrderEmailContext(orderId: string): Promise<OrderEmailContext | null> {
  const admin = createAdminClient();
  const [{ data: order }, { data: items }] = await Promise.all([
    admin.from("orders").select("*").eq("id", orderId).maybeSingle(),
    admin.from("order_items").select("code, name, size, qty, unit_price").eq("order_id", orderId).order("code"),
  ]);
  if (!order) return null;
  return { ...orderEmailBase(), order, items: items ?? [] };
}

export type NotifyResult =
  | { sent: true }
  | { sent: false; skipped: "already_sent" | "in_progress" | "not_found" | "no_recipient" }
  | { sent: false; error: string };

/**
 * Claims the (order, kind) row in order_notifications, then sends. A message that was
 * already sent is never sent again; a failed one is retried on the next call.
 */
async function claim(orderId: string, kind: string, recipient: string) {
  const admin = createAdminClient();
  const { data: inserted, error } = await admin
    .from("order_notifications")
    .insert({ order_id: orderId, kind, recipient })
    .select("id")
    .maybeSingle();
  if (inserted) return { id: inserted.id };
  if (error && error.code !== "23505") return { error: error.message };

  const { data: existing } = await admin
    .from("order_notifications")
    .select("id, sent_at, error, created_at")
    .eq("order_id", orderId)
    .eq("kind", kind)
    .maybeSingle();
  if (!existing) return { error: "Could not claim notification." };
  if (existing.sent_at) return { skipped: "already_sent" as const };
  const stale = Date.now() - new Date(existing.created_at).getTime() > STALE_CLAIM_MS;
  if (!existing.error && !stale) return { skipped: "in_progress" as const };

  const { data: retried } = await admin
    .from("order_notifications")
    .update({ error: null, recipient, created_at: new Date().toISOString() })
    .eq("id", existing.id)
    .eq("created_at", existing.created_at)
    .select("id")
    .maybeSingle();
  return retried ? { id: retried.id } : { skipped: "in_progress" as const };
}

/** Records a message sent by another path (the receipt email) so Admin shows it in the log. */
export async function recordNotification(orderId: string, kind: string, recipient: string) {
  const admin = createAdminClient();
  await admin
    .from("order_notifications")
    .upsert(
      { order_id: orderId, kind, recipient, sent_at: new Date().toISOString(), error: null },
      { onConflict: "order_id,kind" },
    );
}

export async function notifyOrder(orderId: string, kind: Exclude<OrderEmailKind, "paid">): Promise<NotifyResult> {
  const ctx = await loadOrderEmailContext(orderId);
  if (!ctx) return { sent: false, skipped: "not_found" };

  const staff = kind === "staff_new_order";
  const to = staff ? staffRecipients() : [ctx.order.email.trim()].filter((e) => EMAIL.test(e));
  if (!to.length) return { sent: false, skipped: "no_recipient" };

  const claimed = await claim(orderId, kind, to.join(", "));
  if ("skipped" in claimed) return { sent: false, skipped: claimed.skipped! };
  if ("error" in claimed) return { sent: false, error: claimed.error! };

  const admin = createAdminClient();
  try {
    const email = renderOrderEmail(kind, ctx);
    await sendEmail({ to, subject: email.subject, html: email.html, text: email.text });
    await admin
      .from("order_notifications")
      .update({ sent_at: new Date().toISOString(), error: null })
      .eq("id", claimed.id);
    return { sent: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Email failed.";
    await admin.from("order_notifications").update({ error: message.slice(0, 500) }).eq("id", claimed.id);
    console.error("order email", kind, orderId, message);
    return { sent: false, error: message };
  }
}

/** Status changes in Admin that email the customer. */
export function emailKindForStatus(status: string): Exclude<OrderEmailKind, "paid" | "staff_new_order"> | null {
  switch (status) {
    case "preparing":
    case "shipped":
    case "delivered":
    case "cancelled":
      return status;
    default:
      return null;
  }
}

/** End of today in Windhoek, as an ISO timestamp. */
function endOfTodayWindhoek(now: Date) {
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Windhoek" }).format(now);
  // Windhoek is UTC+2 all year.
  return new Date(`${day}T23:59:59+02:00`).toISOString();
}

export async function sendLateOrdersDigest(now = new Date()) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("orders")
    .select("id, full_name, shipping_method, status, total, due_at")
    .in("status", ["reserved", "preparing"])
    .not("due_at", "is", null)
    .lte("due_at", endOfTodayWindhoek(now))
    .order("due_at", { ascending: true })
    .limit(200);
  if (error) throw new Error(error.message);
  const rows: LateOrderRow[] = (data ?? []).flatMap((r) => (r.due_at ? [{ ...r, due_at: r.due_at }] : []));
  if (!rows.length) return { sent: false as const, count: 0 };

  const to = staffRecipients();
  if (!to.length) return { sent: false as const, count: rows.length, skipped: "no_recipient" };
  const email = renderLateOrdersDigest(rows, orderEmailBase(), now);
  await sendEmail({ to, subject: email.subject, html: email.html, text: email.text });
  return { sent: true as const, count: rows.length };
}
