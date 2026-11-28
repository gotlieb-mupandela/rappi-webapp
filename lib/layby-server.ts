import "server-only";

import { revalidateCatalog } from "@/lib/admin/revalidate-catalog";
import type { Database } from "@/lib/database.types";
import { laybyInfo, type LaybyPaymentInfo } from "@/lib/dpo-payload";
import { sendOrderInvoice } from "@/lib/invoice-email";
import {
  LAYBY,
  laybyBalance,
  laybyCancellation,
  laybyPlan,
  laybyReminderDue,
  laybySuggested,
} from "@/lib/layby";
import { buildLaybyPdf, laybyPdfFilename, type LaybyDocData } from "@/lib/layby-pdf";
import {
  LIME,
  MUTED,
  RULE,
  button,
  emailDate,
  emailMoney,
  factRows,
  firstName,
  heading,
  layout,
  para,
  pill,
  type OrderEmailContext,
} from "@/lib/order-emails";
import { notifyOrder, orderEmailBase, staffRecipients } from "@/lib/order-notify";
import { sendEmail } from "@/lib/resend-pdf";
import { createAdminClient } from "@/lib/supabase/admin";
import { escapeHtml } from "@/lib/html-escape";

type Payment = Database["public"]["Tables"]["payments"]["Row"];
export type LaybyRow = Database["public"]["Tables"]["laybys"]["Row"];

export async function loadLaybyDoc(laybyId: string): Promise<LaybyDocData | null> {
  const admin = createAdminClient();
  const { data: layby } = await admin.from("laybys").select("*").eq("id", laybyId).maybeSingle();
  if (!layby) return null;
  const [{ data: order }, { data: items }, { data: payments }] = await Promise.all([
    admin.from("orders").select("*").eq("id", layby.order_id).maybeSingle(),
    admin.from("order_items").select("code, name, size, qty, unit_price").eq("order_id", layby.order_id).order("code"),
    admin.from("layby_payments").select("created_at, amount, method, kind").eq("layby_id", laybyId).order("created_at"),
  ]);
  if (!order) return null;
  return {
    layby,
    order: {
      shipping_method: order.shipping_method,
      shipping_cost: Number(order.shipping_cost),
      vat_rate: Number(order.vat_rate),
      vat_amount: Number(order.vat_amount),
      address: order.address,
      city: order.city,
    },
    items: (items ?? []).map((i) => ({ ...i, unit_price: Number(i.unit_price) })),
    payments: (payments ?? []).map((p) => ({ ...p, amount: Number(p.amount) })),
  };
}

/** Claims an email kind for a layby once (unique layby_id + kind). Retries a failed send. */
async function claim(laybyId: string, kind: string, recipient: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("layby_notifications")
    .insert({ layby_id: laybyId, kind, recipient })
    .select("id")
    .maybeSingle();
  if (data) return data.id;
  if (error && error.code !== "23505") throw new Error(error.message);
  const { data: existing } = await admin
    .from("layby_notifications")
    .select("id, sent_at")
    .eq("layby_id", laybyId)
    .eq("kind", kind)
    .maybeSingle();
  return existing && !existing.sent_at ? existing.id : null;
}

async function sendOnce(
  laybyId: string,
  kind: string,
  to: string[],
  build: () => Promise<{ subject: string; html: string; text: string; pdf?: Uint8Array }>,
) {
  if (!to.length) return { sent: false, skipped: "no_recipient" as const };
  const id = await claim(laybyId, kind, to.join(", "));
  if (!id) return { sent: false, skipped: "already" as const };
  const admin = createAdminClient();
  try {
    const m = await build();
    await sendEmail({
      to,
      subject: m.subject,
      html: m.html,
      text: m.text,
      attachments: m.pdf ? [{ filename: laybyPdfFilename(laybyId), content: m.pdf }] : undefined,
    });
    await admin.from("layby_notifications").update({ sent_at: new Date().toISOString(), error: null }).eq("id", id);
    return { sent: true as const };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Email failed.";
    await admin.from("layby_notifications").update({ error: message.slice(0, 500) }).eq("id", id);
    console.error("layby email", kind, laybyId, message);
    return { sent: false, error: message };
  }
}

function ctxFor(d: LaybyDocData): OrderEmailContext {
  return {
    ...orderEmailBase(),
    order: {
      id: d.layby.order_id,
      full_name: d.layby.name,
      email: d.layby.email,
      shipping_method: d.order.shipping_method,
      shipping_cost: d.order.shipping_cost,
      subtotal: 0,
      total: d.layby.total,
      created_at: d.layby.opened_at,
    },
    items: d.items,
  };
}

function progressBar(paid: number, total: number) {
  const pct = Math.max(0, Math.min(100, Math.round((paid / total) * 100)));
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px"><tr><td style="font-size:13px;color:${MUTED};padding-bottom:6px">${pct}% paid &middot; ${emailMoney(paid)} of ${emailMoney(total)}</td></tr>
<tr><td style="background:#eeeeee;border-radius:99px;height:12px;line-height:12px;font-size:0"><div style="width:${pct}%;background:${LIME};border-radius:99px;height:12px"></div></td></tr></table>`;
}

function itemsList(d: LaybyDocData) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px">${d.items
    .map(
      (i) =>
        `<tr><td style="padding:8px 0;border-bottom:1px solid ${RULE};font-size:14px"><strong>${escapeHtml(i.name.replace(/\s*·\s*[\w.-]+$/, ""))}</strong><div style="font-size:12px;color:${MUTED}">${escapeHtml(i.code)}${i.size ? ` &middot; Size ${escapeHtml(i.size)}` : ""} &middot; Qty ${i.qty}</div></td><td style="padding:8px 0;border-bottom:1px solid ${RULE};text-align:right;font-size:14px;white-space:nowrap">${emailMoney(i.unit_price * i.qty)}</td></tr>`,
    )
    .join("")}</table>`;
}

function facts(d: LaybyDocData, extra: [string, string][] = []) {
  const plan = laybyPlan(d.layby.total, new Date(d.layby.opened_at));
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;background:#fafafa;border:1px solid ${RULE};border-radius:10px;padding:12px 14px">${factRows([
    ["Layby", d.layby.id],
    ["Total (price fixed)", emailMoney(d.layby.total)],
    ["Paid so far", emailMoney(d.layby.paid)],
    ["Balance", emailMoney(laybyBalance(d.layby))],
    ["Suggested monthly", emailMoney(plan.monthly)],
    ["Pay in full by", emailDate(d.layby.final_due_at)],
    ...extra,
  ])}</table>`;
}

const accountUrl = (siteUrl: string, id: string) => `${siteUrl}/account/laybys/${encodeURIComponent(id)}`;

/** Customer: layby opened (agreement PDF attached). Staff: new layby. */
export async function sendLaybyOpened(laybyId: string) {
  const d = await loadLaybyDoc(laybyId);
  if (!d) return;
  const base = orderEmailBase();
  const url = accountUrl(base.siteUrl, laybyId);
  await sendOnce(laybyId, "opened", [d.layby.email], async () => {
    const ctx = ctxFor(d);
    const body = [
      heading("Your layby is open"),
      para(
        `Hi ${escapeHtml(firstName(d.layby.name))}, thank you! Your deposit of <strong>${emailMoney(d.layby.paid)}</strong> was approved and these items are now <strong>reserved for you</strong> at a fixed price.`,
      ),
      progressBar(d.layby.paid, d.layby.total),
      itemsList(d),
      facts(d),
      para(
        `Pay the balance in any amounts of N$${LAYBY.MIN_PAYMENT} or more, whenever suits you, by <strong>${escapeHtml(emailDate(d.layby.final_due_at))}</strong>. We'll remind you a week before each monthly date. When it's fully paid, we send your order (or have it ready at the Hub).`,
      ),
      button(url, "Pay or view my layby"),
      para(`<span style="font-size:13px;color:${MUTED}">Your layby agreement is attached. If a layby is cancelled, an admin fee of 30% of the total applies (never more than you've paid). Terms, clause 7.</span>`),
    ].join("");
    return {
      subject: `Layby ${laybyId} opened – ${emailMoney(laybyBalance(d.layby))} to go`,
      html: layout(ctx, body, `Deposit ${emailMoney(d.layby.paid)} received. Items reserved until ${emailDate(d.layby.final_due_at)}.`),
      text: `Hi ${firstName(d.layby.name)},\n\nYour layby ${laybyId} is open. Deposit ${emailMoney(d.layby.paid)} received; balance ${emailMoney(laybyBalance(d.layby))}, to be paid by ${emailDate(d.layby.final_due_at)}.\n\nPay or view: ${url}\n\nYour layby agreement is attached.`,
      pdf: await buildLaybyPdf(d),
    };
  });
  await sendOnce(laybyId, "staff_opened", staffRecipients(), async () => {
    const ctx = ctxFor(d);
    const admin = `${base.siteUrl}/admin/laybys/${encodeURIComponent(laybyId)}`;
    const body = [
      `<div>${pill("New layby", LIME)}</div>`,
      heading(`${escapeHtml(d.layby.name)} opened layby ${escapeHtml(laybyId)}`),
      para(
        `Deposit <strong>${emailMoney(d.layby.paid)}</strong> paid on a total of <strong>${emailMoney(d.layby.total)}</strong>. The stock below is reserved. <strong>Do not pack or send</strong> until the layby is fully paid and the last payment has cleared.`,
      ),
      itemsList(d),
      facts(d, [["Customer", `${d.layby.name}, ${d.layby.email}${d.layby.phone ? `, ${d.layby.phone}` : ""}`]]),
      button(admin, "Open layby in Admin"),
    ].join("");
    return {
      subject: `🧾 New layby ${laybyId} – ${emailMoney(d.layby.paid)} deposit on ${emailMoney(d.layby.total)} – ${d.layby.name}`,
      html: layout(ctx, body, `Deposit ${emailMoney(d.layby.paid)}. Reserve the stock; don't send yet.`),
      text: `New layby ${laybyId}\n${d.layby.name} paid a deposit of ${emailMoney(d.layby.paid)} on ${emailMoney(d.layby.total)}. Do not send until fully paid.\n\nAdmin: ${admin}`,
      pdf: await buildLaybyPdf(d),
    };
  });
}

/** Customer receipt for one layby payment (card or recorded in store). */
export async function sendLaybyPaymentReceipt(laybyId: string, paymentKey: string, amount: number) {
  const d = await loadLaybyDoc(laybyId);
  if (!d) return;
  const base = orderEmailBase();
  const url = accountUrl(base.siteUrl, laybyId);
  const done = laybyBalance(d.layby) <= 0;
  await sendOnce(laybyId, `payment:${paymentKey}`, [d.layby.email], async () => {
    const body = [
      heading(done ? "Layby paid in full! 🎉" : "Layby payment received"),
      para(
        done
          ? `Hi ${escapeHtml(firstName(d.layby.name))}, your last payment of <strong>${emailMoney(amount)}</strong> is in and layby <strong>${escapeHtml(laybyId)}</strong> is <strong>fully paid</strong>. Your invoice follows in a separate email. We pack and send your order (or have it ready at the Hub) once this payment has cleared, usually about 3 business days.`
          : `Hi ${escapeHtml(firstName(d.layby.name))}, we've received <strong>${emailMoney(amount)}</strong> for layby <strong>${escapeHtml(laybyId)}</strong>. Thank you!`,
      ),
      progressBar(d.layby.paid, d.layby.total),
      facts(d),
      done ? "" : button(url, "Pay or view my layby"),
    ].join("");
    return {
      subject: done ? `Layby ${laybyId} paid in full` : `Layby ${laybyId}: ${emailMoney(amount)} received – ${emailMoney(laybyBalance(d.layby))} to go`,
      html: layout(ctxFor(d), body, done ? "Fully paid. Your order is on its way soon." : `${emailMoney(laybyBalance(d.layby))} left to pay.`),
      text: `Layby ${laybyId}: ${emailMoney(amount)} received. Paid ${emailMoney(d.layby.paid)} of ${emailMoney(d.layby.total)}. Balance ${emailMoney(laybyBalance(d.layby))}.\n\n${url}`,
      pdf: await buildLaybyPdf(d),
    };
  });
}

/** When a layby is fully paid: the normal invoice to the customer and the sale email to staff. */
export async function completeLayby(layby: LaybyRow) {
  if (layby.status !== "paid") return;
  try {
    await sendOrderInvoice(layby.order_id);
  } catch (err) {
    console.error("layby invoice", layby.id, err);
  }
  try {
    await notifyOrder(layby.order_id, "staff_new_order");
  } catch (err) {
    console.error("layby staff sale email", layby.id, err);
  }
}

/** Runs after DPO confirms a layby payment. Returns the layby id (and order id for deposits). */
export async function fulfillLaybyPayment(payment: Payment, info: LaybyPaymentInfo) {
  const admin = createAdminClient();
  if (info.kind === "deposit") {
    const { data: laybyId, error } = await admin.rpc("open_layby_from_payment", { p_payment_id: payment.id });
    if (error || !laybyId) throw new Error(error?.message ?? "Could not open layby.");
    try {
      revalidateCatalog();
    } catch {
      // Stock refresh is best effort.
    }
    await sendLaybyOpened(laybyId).catch((err) => console.error("layby opened email", err));
    const { data } = await admin.from("laybys").select("order_id").eq("id", laybyId).maybeSingle();
    return { laybyId, orderId: data?.order_id ?? null };
  }
  const { data: layby, error } = await admin.rpc("apply_layby_payment", { p_payment_id: payment.id });
  if (error || !layby) throw new Error(error?.message ?? "Could not record layby payment.");
  await sendLaybyPaymentReceipt(layby.id, payment.id, Number(payment.amount)).catch((err) => console.error("layby receipt", err));
  if (layby.status === "paid") await completeLayby(layby);
  return { laybyId: layby.id, orderId: layby.order_id };
}

export function paymentLaybyInfo(payment: Payment | null) {
  return payment ? laybyInfo(payment.payload) : null;
}

/** Staff records a cash/EFT payment taken in store. */
export async function recordLaybyCashPayment(laybyId: string, amount: number, method: "cash" | "eft", by: string) {
  const admin = createAdminClient();
  const { data: layby, error } = await admin.rpc("layby_add_payment", {
    p_layby_id: laybyId,
    p_amount: amount,
    p_method: method,
    p_recorded_by: by,
    p_kind: "instalment",
  });
  if (error || !layby) throw new Error(error?.message ?? "Could not record payment.");
  await sendLaybyPaymentReceipt(laybyId, `${method}-${Date.now()}`, amount).catch((err) => console.error("layby receipt", err));
  if (layby.status === "paid") await completeLayby(layby);
  return layby;
}

export async function cancelLayby(laybyId: string, reason: string, by: string) {
  const admin = createAdminClient();
  const { data: layby, error } = await admin.rpc("cancel_layby", { p_layby_id: laybyId, p_reason: reason, p_by: by });
  if (error || !layby) throw new Error(error?.message ?? "Could not cancel layby.");
  try {
    revalidateCatalog();
  } catch {
    // best effort
  }
  const d = await loadLaybyDoc(laybyId);
  if (d) {
    await sendOnce(laybyId, "cancelled", [d.layby.email], async () => ({
      subject: `Layby ${laybyId} cancelled`,
      html: layout(
        ctxFor(d),
        [
          heading("Your layby was cancelled"),
          para(
            `Hi ${escapeHtml(firstName(d.layby.name))}, layby <strong>${escapeHtml(laybyId)}</strong> has been cancelled${reason ? ` (${escapeHtml(reason)})` : ""}. The items have gone back into stock.`,
          ),
          facts(d, [
            ["Admin fee (30%, capped at amount paid)", emailMoney(layby.cancel_fee)],
            ["Refund due to you", emailMoney(layby.refund_amount)],
          ]),
          para(
            Number(layby.refund_amount) > 0
              ? "We'll refund this amount by the method you paid with. Card refunds can take a few working days to show. Questions? Reply to this email or WhatsApp 081 814 1646."
              : "No refund is due, as the admin fee equals the amount paid. Questions? Reply to this email or WhatsApp 081 814 1646.",
          ),
        ].join(""),
        `Layby ${laybyId} cancelled. Refund due: ${emailMoney(layby.refund_amount)}.`,
      ),
      text: `Layby ${laybyId} cancelled. Admin fee ${emailMoney(layby.cancel_fee)}. Refund due ${emailMoney(layby.refund_amount)}.`,
    }));
  }
  return layby;
}

/** Reminder or written notice for one layby, if one is due today. */
export async function sendLaybyReminder(layby: LaybyRow, now = new Date(), force = false) {
  const due = laybyReminderDue(layby, now);
  const kind = force ? `manual:${now.toISOString().slice(0, 10)}` : due?.kind;
  if (!kind) return { sent: false as const };
  const d = await loadLaybyDoc(layby.id);
  if (!d) return { sent: false as const };
  const base = orderEmailBase();
  const url = accountUrl(base.siteUrl, layby.id);
  const suggested = laybySuggested(layby, now);
  const expired = due?.kind === "expired_notice";
  const { fee } = laybyCancellation(layby);
  return sendOnce(layby.id, kind, [layby.email], async () => ({
    subject: expired
      ? `Important: layby ${layby.id} is past its final date`
      : `Reminder: layby ${layby.id} – suggested payment ${emailMoney(suggested)}${due ? ` by ${emailDate(due.date.toISOString())}` : ""}`,
    html: layout(
      ctxFor(d),
      [
        heading(expired ? "Your layby is past its final date" : "A friendly layby reminder"),
        para(
          expired
            ? `Hi ${escapeHtml(firstName(layby.name))}, layby <strong>${escapeHtml(layby.id)}</strong> had to be paid in full by <strong>${escapeHtml(emailDate(layby.final_due_at))}</strong> and <strong>${emailMoney(laybyBalance(layby))}</strong> is still outstanding. This is our written notice under clause 7 of our Terms: please pay the balance within 7 days or contact us. If not, we may cancel the layby, return the items to stock and refund what you've paid less the 30% admin fee (${emailMoney(fee)}).`
            : `Hi ${escapeHtml(firstName(layby.name))}, just a reminder about layby <strong>${escapeHtml(layby.id)}</strong>. To stay on track, the suggested payment is <strong>${emailMoney(suggested)}</strong>${due ? ` by <strong>${escapeHtml(emailDate(due.date.toISOString()))}</strong>` : ""}. You can pay any amount from N$${LAYBY.MIN_PAYMENT}.`,
        ),
        progressBar(layby.paid, layby.total),
        facts(d),
        button(url, "Pay now"),
      ].join(""),
      expired ? "Please pay within 7 days or contact us." : `Suggested payment ${emailMoney(suggested)}.`,
    ),
    text: `Layby ${layby.id}: balance ${emailMoney(laybyBalance(layby))}, pay in full by ${emailDate(layby.final_due_at)}. Suggested payment ${emailMoney(suggested)}.\n\nPay: ${url}`,
  }));
}

/** Daily job: reminders and written notices for active laybys. */
export async function sendLaybyReminders(now = new Date(), cap = 40) {
  const admin = createAdminClient();
  const { data } = await admin.from("laybys").select("*").eq("status", "active").order("final_due_at").limit(500);
  let sent = 0;
  for (const l of data ?? []) {
    if (sent >= cap) break;
    const r = await sendLaybyReminder(l, now);
    if (r.sent) sent += 1;
  }
  return { checked: data?.length ?? 0, sent };
}
