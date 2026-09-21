import "server-only";

import { createHash } from "node:crypto";
import { isDpoPaymentPayload } from "@/lib/dpo-payload";
import type { Database } from "@/lib/database.types";
import { META_PIXEL_ID } from "@/lib/meta/config";
import { feedVariantId } from "@/lib/meta/ids";
import { metaSiteUrl } from "@/lib/meta/site";

type Payment = Database["public"]["Tables"]["payments"]["Row"];

function sha256(value: string) {
  return createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
}

function splitName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return { first: parts[0] ?? "", last: parts.slice(1).join(" ") };
}

export function purchaseContentsFromPayment(payment: Payment) {
  const payload = payment.payload;
  if (isDpoPaymentPayload(payload)) {
    return payload.lines.map((line) => ({
      id: feedVariantId(line.code, line.size),
      quantity: line.qty,
      item_price: Number(line.price),
    }));
  }
  if (payment.product_code) {
    return [{ id: payment.product_code, quantity: 1, item_price: Number(payment.amount) }];
  }
  return [];
}

export async function sendMetaPurchaseCapi(payment: Payment) {
  const pixelId = META_PIXEL_ID;
  const token = process.env.META_CAPI_ACCESS_TOKEN?.trim();
  if (!pixelId || !token) return;

  const contents = purchaseContentsFromPayment(payment);
  const payload = isDpoPaymentPayload(payment.payload) ? payment.payload : null;
  const email = payment.customer_email || payload?.email || "";
  const name = payment.customer_name || payload?.name || "";
  const { first, last } = splitName(name);
  const userData: Record<string, string | string[]> = {};
  if (email) userData.em = [sha256(email)];
  if (first) userData.fn = [sha256(first)];
  if (last) userData.ln = [sha256(last)];
  if (payload?.city) userData.ct = [sha256(payload.city)];
  if (payload?.country) userData.country = [sha256(payload.country)];

  const body = {
    data: [
      {
        event_name: "Purchase",
        event_time: Math.floor(Date.now() / 1000),
        event_id: payment.id,
        event_source_url: `${metaSiteUrl()}/checkout/return`,
        action_source: "website",
        user_data: userData,
        custom_data: {
          currency: "NAD",
          value: Number(payment.amount),
          content_type: "product",
          content_ids: contents.map((item) => item.id),
          contents,
          num_items: contents.reduce((n, item) => n + (item.quantity ?? 1), 0),
        },
      },
    ],
  };

  const res = await fetch(`https://graph.facebook.com/v21.0/${pixelId}/events?access_token=${token}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error("Meta CAPI Purchase failed", res.status, text.slice(0, 400));
  }
}
