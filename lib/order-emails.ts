import { escapeHtml } from "@/lib/html-escape";

/** Messages the system sends about an order. One row per kind in `order_notifications`. */
export const ORDER_EMAIL_KINDS = [
  "paid",
  "preparing",
  "shipped",
  "delivered",
  "cancelled",
  "staff_new_order",
] as const;
export type OrderEmailKind = (typeof ORDER_EMAIL_KINDS)[number];

export type OrderEmailOrder = {
  id: string;
  full_name: string;
  email: string;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  shipping_method: string;
  shipping_cost: number | string;
  subtotal: number | string;
  discount_code?: string | null;
  discount_amount?: number | string | null;
  vat_rate?: number | string | null;
  vat_amount?: number | string | null;
  total: number | string;
  created_at: string;
  due_at?: string | null;
  courier?: string | null;
  tracking_number?: string | null;
};

export type OrderEmailItem = {
  code: string;
  name: string;
  size: string;
  qty: number;
  unit_price: number | string;
};

export type OrderEmailContext = {
  order: OrderEmailOrder;
  items: OrderEmailItem[];
  /** Absolute site origin, e.g. https://www.rappisportshub.com */
  siteUrl: string;
  /** Absolute URL (or cid:) of the logo image. */
  logoUrl: string;
  sellerName: string;
  contactEmail: string;
  contactPhone: string;
};

export type RenderedEmail = { subject: string; html: string; text: string };

const INK = "#111111";
const MUTED = "#5a5a5a";
const RULE = "#e3e3e3";
const LIME = "#5eff38";

export function emailMoney(value: number | string | null | undefined) {
  const n = new Intl.NumberFormat("en-NA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);
  return `N$${n}`;
}

/** "Thu 27 Nov 2026" in Windhoek time. */
export function emailDate(iso: string | null | undefined) {
  if (!iso) return "";
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Africa/Windhoek",
  }).format(new Date(iso));
}

function firstName(full: string) {
  return full.trim().split(/\s+/)[0] || "there";
}

function isPickup(order: OrderEmailOrder) {
  return /pickup/i.test(order.shipping_method);
}

function itemRows(items: OrderEmailItem[]) {
  return items
    .map((item) => {
      const line = Number(item.unit_price) * item.qty;
      return `<tr>
<td style="padding:10px 0;border-bottom:1px solid ${RULE};font-size:14px;color:${INK}">
<div style="font-weight:bold">${escapeHtml(item.name)}</div>
<div style="font-size:12px;color:${MUTED};margin-top:2px">${escapeHtml(item.code)}${
        item.size ? ` &middot; Size ${escapeHtml(item.size)}` : ""
      } &middot; Qty ${item.qty}</div>
</td>
<td style="padding:10px 0;border-bottom:1px solid ${RULE};font-size:14px;color:${INK};text-align:right;white-space:nowrap;vertical-align:top">${emailMoney(line)}</td>
</tr>`;
    })
    .join("");
}

function totalsRows(order: OrderEmailOrder) {
  const rows: Array<[string, string, boolean?]> = [["Items", emailMoney(order.subtotal)]];
  const discount = Number(order.discount_amount) || 0;
  if (discount > 0) {
    rows.push([`Discount${order.discount_code ? ` (${order.discount_code})` : ""}`, `-${emailMoney(discount)}`]);
  }
  rows.push([order.shipping_method || "Shipping", emailMoney(order.shipping_cost)]);
  if (Number(order.vat_amount) > 0) {
    rows.push([`VAT ${Number(order.vat_rate) || 0}%`, emailMoney(order.vat_amount)]);
  }
  rows.push(["Total paid", emailMoney(order.total), true]);
  return rows
    .map(
      ([label, value, strong]) => `<tr>
<td style="padding:4px 0;font-size:${strong ? 16 : 13}px;color:${strong ? INK : MUTED};${strong ? "font-weight:bold;padding-top:10px" : ""}">${escapeHtml(label)}</td>
<td style="padding:4px 0;font-size:${strong ? 16 : 13}px;color:${INK};text-align:right;white-space:nowrap;${strong ? "font-weight:bold;padding-top:10px" : ""}">${value}</td>
</tr>`,
    )
    .join("");
}

function factRows(facts: Array<[string, string]>) {
  return facts
    .filter(([, value]) => value)
    .map(
      ([label, value]) => `<tr>
<td style="padding:3px 12px 3px 0;font-size:13px;color:${MUTED};white-space:nowrap;vertical-align:top">${escapeHtml(label)}</td>
<td style="padding:3px 0;font-size:13px;color:${INK};font-weight:bold">${escapeHtml(value)}</td>
</tr>`,
    )
    .join("");
}

function progress(step: 0 | 1 | 2 | 3) {
  const labels = ["Paid", "Preparing", "Shipped", "Delivered"];
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0 4px"><tr>${labels
    .map((label, i) => {
      const done = i <= step;
      return `<td style="width:25%;padding:0 2px;vertical-align:top">
<div style="height:4px;border-radius:2px;background:${done ? LIME : RULE}"></div>
<div style="font-size:11px;margin-top:6px;color:${done ? INK : "#9a9a9a"};${i === step ? "font-weight:bold" : ""}">${label}</div>
</td>`;
    })
    .join("")}</tr></table>`;
}

function layout(ctx: OrderEmailContext, body: string, preheader: string) {
  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(ctx.sellerName)}</title></head>
<body style="margin:0;padding:0;background:#f4f4f4">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;font-family:Arial,Helvetica,sans-serif;color:${INK}">
<tr><td style="padding:20px 24px;border-bottom:3px solid ${LIME}"><img src="${escapeHtml(ctx.logoUrl)}" alt="${escapeHtml(ctx.sellerName)}" width="140" style="display:block;height:auto;border:0" /></td></tr>
<tr><td style="padding:24px">${body}</td></tr>
<tr><td style="padding:16px 24px;background:#fafafa;border-top:1px solid ${RULE};font-size:12px;line-height:18px;color:${MUTED}">
Questions? Reply to this email, write to <a href="mailto:${escapeHtml(ctx.contactEmail)}" style="color:${INK}">${escapeHtml(ctx.contactEmail)}</a> or call ${escapeHtml(ctx.contactPhone)}.<br />
${escapeHtml(ctx.sellerName)} &middot; Windhoek, Namibia &middot; <a href="${escapeHtml(ctx.siteUrl)}" style="color:${INK}">${escapeHtml(ctx.siteUrl.replace(/^https?:\/\//, ""))}</a>
</td></tr>
</table>
</td></tr></table>
</body></html>`;
}

function button(href: string, label: string) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0 4px"><tr><td style="background:${INK};border-radius:999px">
<a href="${escapeHtml(href)}" style="display:inline-block;padding:12px 22px;font-size:14px;font-weight:bold;color:#ffffff;text-decoration:none">${escapeHtml(label)}</a>
</td></tr></table>`;
}

function orderSummary(ctx: OrderEmailContext, title = "Your order") {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px">
<tr><td colspan="2" style="font-size:12px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;color:${MUTED};padding-bottom:4px;border-bottom:1px solid ${RULE}">${escapeHtml(title)}</td></tr>
${itemRows(ctx.items)}
</table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px">${totalsRows(ctx.order)}</table>`;
}

function deliveryFacts(ctx: OrderEmailContext, extra: Array<[string, string]> = []) {
  const { order } = ctx;
  const where = isPickup(order)
    ? "Collect at our Windhoek hub"
    : [order.address, order.city, order.country].filter(Boolean).join(", ");
  const facts: Array<[string, string]> = [
    ["Order", order.id],
    ["Delivery", order.shipping_method],
    [isPickup(order) ? "Ready by" : "Expected by", emailDate(order.due_at)],
    ...extra,
    [isPickup(order) ? "Pickup" : "Deliver to", where],
  ];
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:16px;background:#fafafa;border:1px solid ${RULE};border-radius:10px;padding:12px 14px;width:100%">${factRows(facts)}</table>`;
}

function textItems(ctx: OrderEmailContext) {
  return ctx.items
    .map((i) => `- ${i.name} (${i.code}${i.size ? `, size ${i.size}` : ""}) x${i.qty}: ${emailMoney(Number(i.unit_price) * i.qty)}`)
    .join("\n");
}

function heading(text: string) {
  return `<h1 style="margin:0;font-size:22px;line-height:28px;color:${INK}">${escapeHtml(text)}</h1>`;
}

function para(html: string) {
  return `<p style="margin:12px 0 0;font-size:15px;line-height:22px;color:${INK}">${html}</p>`;
}

export type LateOrderRow = {
  id: string;
  full_name: string;
  shipping_method: string;
  status: string;
  total: number | string;
  due_at: string;
};

/** Morning email to staff: open orders that are past their promise or due today. */
export function renderLateOrdersDigest(
  rows: LateOrderRow[],
  ctx: Pick<OrderEmailContext, "siteUrl" | "logoUrl" | "sellerName" | "contactEmail" | "contactPhone">,
  now: Date = new Date(),
): RenderedEmail {
  const today = emailDate(now.toISOString());
  const late = rows.filter((r) => new Date(r.due_at).getTime() < now.getTime());
  const dueToday = rows.filter((r) => new Date(r.due_at).getTime() >= now.getTime());
  const table = (title: string, list: LateOrderRow[], colour: string) =>
    list.length
      ? `<p style="margin:20px 0 6px;font-size:12px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;color:${colour}">${escapeHtml(title)} (${list.length})</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${list
          .map((r) => {
            const days = Math.max(0, Math.floor((now.getTime() - new Date(r.due_at).getTime()) / 86_400_000));
            return `<tr>
<td style="padding:8px 0;border-bottom:1px solid ${RULE};font-size:13px;color:${INK}">
<a href="${escapeHtml(`${ctx.siteUrl}/admin/orders/${encodeURIComponent(r.id)}`)}" style="color:${INK};font-weight:bold">${escapeHtml(r.id)}</a>
<div style="font-size:12px;color:${MUTED};margin-top:2px">${escapeHtml(r.full_name)} &middot; ${escapeHtml(r.shipping_method)} &middot; ${escapeHtml(r.status)}</div>
</td>
<td style="padding:8px 0;border-bottom:1px solid ${RULE};font-size:12px;color:${colour};text-align:right;white-space:nowrap;vertical-align:top">
${escapeHtml(emailDate(r.due_at))}${title.startsWith("Late") ? `<br />${days} ${days === 1 ? "day" : "days"} late` : ""}
<div style="color:${INK};margin-top:2px">${emailMoney(r.total)}</div>
</td>
</tr>`;
          })
          .join("")}</table>`
      : "";
  const subject = `Orders to chase today: ${late.length} late, ${dueToday.length} due today`;
  const body = [
    heading("Orders to chase today"),
    para(`${escapeHtml(today)}: <strong>${late.length}</strong> ${late.length === 1 ? "order is" : "orders are"} past the delivery date promised to the customer and <strong>${dueToday.length}</strong> ${dueToday.length === 1 ? "is" : "are"} due today.`),
    table("Late", late, "#c62828"),
    table("Due today", dueToday, "#b26a00"),
    button(`${ctx.siteUrl}/admin/orders`, "Open orders in Admin"),
  ].join("");
  const text = [
    `Orders to chase today (${today})`,
    ...late.map((r) => `LATE ${r.id} - ${r.full_name} - ${r.shipping_method} - due ${emailDate(r.due_at)}`),
    ...dueToday.map((r) => `DUE TODAY ${r.id} - ${r.full_name} - ${r.shipping_method}`),
    `${ctx.siteUrl}/admin/orders`,
  ].join("\n");
  return { subject, html: layout(ctx as OrderEmailContext, body, `${late.length} late, ${dueToday.length} due today.`), text };
}

export function renderOrderEmail(kind: OrderEmailKind, ctx: OrderEmailContext): RenderedEmail {
  const { order } = ctx;
  const name = escapeHtml(firstName(order.full_name));
  const ordersUrl = `${ctx.siteUrl}/account/orders`;
  const due = emailDate(order.due_at);

  switch (kind) {
    case "paid": {
      const subject = `Payment approved – order ${order.id}`;
      const body = [
        heading("Payment approved, thank you!"),
        para(
          `Hi ${name}, your payment of <strong>${emailMoney(order.total)}</strong> was approved by DPO Pay and your order is confirmed.`,
        ),
        para(
          `Card payments take about <strong>3 business days</strong> to reach our bank. As soon as the money arrives, we ${
            isPickup(order) ? "get your order ready at the Hub" : "pack and send your order"
          } and email you${due ? `. ${isPickup(order) ? "Expected ready" : "Expected delivery"}: <strong>${escapeHtml(due)}</strong>` : ""}.`,
        ),
        para("Your receipt is attached. Delivery times count from the day your payment clears (see our Terms, clause 5)."),
        progress(0),
        deliveryFacts(ctx),
        orderSummary(ctx),
        button(ordersUrl, "View your order"),
      ].join("");
      return {
        subject,
        html: layout(ctx, body, `Payment of ${emailMoney(order.total)} approved. Expected by ${due}.`),
        text: `Hi ${firstName(order.full_name)},\n\nYour payment of ${emailMoney(order.total)} for order ${order.id} was approved by DPO Pay. Card payments take about 3 business days to reach our bank; as soon as the money arrives we ${
          isPickup(order) ? "get your order ready at the Hub" : "pack and send your order"
        }${due ? ` (expected by ${due})` : ""}. Your receipt is attached.\n\n${textItems(ctx)}\n\nTotal paid: ${emailMoney(order.total)}\n\nView your order: ${ordersUrl}\n\n${ctx.sellerName}`,
      };
    }
    case "preparing": {
      const subject = `We're packing your order ${order.id}`;
      const body = [
        heading("We're packing your order"),
        para(
          `Hi ${name}, our team is now picking and packing order <strong>${escapeHtml(order.id)}</strong>.${
            due ? ` It's on track for <strong>${escapeHtml(due)}</strong>.` : ""
          }`,
        ),
        progress(1),
        deliveryFacts(ctx),
        button(ordersUrl, "Track your order"),
      ].join("");
      return {
        subject,
        html: layout(ctx, body, `Order ${order.id} is being packed.`),
        text: `Hi ${firstName(order.full_name)},\n\nWe're packing order ${order.id}.${due ? ` It's on track for ${due}.` : ""}\n\nTrack it: ${ordersUrl}\n\n${ctx.sellerName}`,
      };
    }
    case "shipped": {
      const pickup = isPickup(order);
      const subject = pickup ? `Your order ${order.id} is ready for pickup` : `Your order ${order.id} is on its way`;
      const extra: Array<[string, string]> = [
        ["Courier", order.courier ?? ""],
        ["Tracking number", order.tracking_number ?? ""],
      ];
      const body = [
        heading(pickup ? "Ready for pickup" : "Your order is on its way"),
        para(
          pickup
            ? `Hi ${name}, order <strong>${escapeHtml(order.id)}</strong> is packed and ready to collect at our Windhoek hub.`
            : `Hi ${name}, order <strong>${escapeHtml(order.id)}</strong> has left our hub${
                due ? ` and should reach you by <strong>${escapeHtml(due)}</strong>` : ""
              }.`,
        ),
        progress(2),
        deliveryFacts(ctx, extra),
        button(ordersUrl, "Track your order"),
      ].join("");
      const trackText = [order.courier ? `Courier: ${order.courier}` : "", order.tracking_number ? `Tracking number: ${order.tracking_number}` : ""]
        .filter(Boolean)
        .join("\n");
      return {
        subject,
        html: layout(ctx, body, pickup ? `Order ${order.id} is ready to collect.` : `Order ${order.id} has shipped.`),
        text: `Hi ${firstName(order.full_name)},\n\n${
          pickup ? `Order ${order.id} is ready to collect at our Windhoek hub.` : `Order ${order.id} is on its way${due ? ` and should reach you by ${due}` : ""}.`
        }\n${trackText ? `\n${trackText}\n` : ""}\nTrack it: ${ordersUrl}\n\n${ctx.sellerName}`,
      };
    }
    case "delivered": {
      const subject = `Delivered – enjoy your gear (order ${order.id})`;
      const body = [
        heading("Delivered – enjoy your gear!"),
        para(`Hi ${name}, order <strong>${escapeHtml(order.id)}</strong> has been delivered. Thank you for shopping with ${escapeHtml(ctx.sellerName)}.`),
        para("If anything isn't right with your order, just reply to this email and we'll sort it out."),
        progress(3),
        button(ctx.siteUrl, "Shop again"),
      ].join("");
      return {
        subject,
        html: layout(ctx, body, `Order ${order.id} was delivered.`),
        text: `Hi ${firstName(order.full_name)},\n\nOrder ${order.id} has been delivered. Thank you for shopping with ${ctx.sellerName}. If anything isn't right, reply to this email.\n\n${ctx.sellerName}`,
      };
    }
    case "cancelled": {
      const subject = `Your order ${order.id} was cancelled`;
      const body = [
        heading("Your order was cancelled"),
        para(
          `Hi ${name}, order <strong>${escapeHtml(order.id)}</strong> has been cancelled. If you paid for it, we'll refund <strong>${emailMoney(
            order.total,
          )}</strong> to your original payment method. Refunds can take a few working days to show.`,
        ),
        para("If you didn't expect this, please reply to this email and we'll help."),
      ].join("");
      return {
        subject,
        html: layout(ctx, body, `Order ${order.id} was cancelled.`),
        text: `Hi ${firstName(order.full_name)},\n\nOrder ${order.id} has been cancelled. If you paid for it, we'll refund ${emailMoney(order.total)} to your original payment method.\n\n${ctx.sellerName}`,
      };
    }
    case "staff_new_order": {
      const adminUrl = `${ctx.siteUrl}/admin/orders/${encodeURIComponent(order.id)}`;
      const pieces = ctx.items.reduce((sum, i) => sum + i.qty, 0);
      const subject = `New order ${order.id} – ${emailMoney(order.total)} – ${order.shipping_method}`;
      const body = [
        heading(`New order ${order.id}`),
        para(`${escapeHtml(order.full_name)} paid <strong>${emailMoney(order.total)}</strong> for ${pieces} ${pieces === 1 ? "piece" : "pieces"}.`),
        `<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:16px;background:#fafafa;border:1px solid ${RULE};border-radius:10px;padding:12px 14px;width:100%">${factRows([
          ["Delivery", order.shipping_method],
          ["Due by", emailDate(order.due_at)],
          ["Customer", order.full_name],
          ["Email", order.email],
          ["Phone", order.phone ?? ""],
          ["Address", [order.address, order.city, order.country].filter(Boolean).join(", ")],
        ])}</table>`,
        orderSummary(ctx, "Items ordered"),
        button(adminUrl, "Open in Admin"),
      ].join("");
      return {
        subject,
        html: layout(ctx, body, `${order.full_name} paid ${emailMoney(order.total)}.`),
        text: `New order ${order.id}\n${order.full_name} paid ${emailMoney(order.total)}.\nDelivery: ${order.shipping_method}, due by ${emailDate(order.due_at)}\n\n${textItems(ctx)}\n\nOpen in Admin: ${adminUrl}`,
      };
    }
  }
}
