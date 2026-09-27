import { createAdminClient } from "@/lib/supabase/admin";
import { isDpoPaymentPayload, type DpoPaymentPayload } from "@/lib/dpo-payload";
import { SHIPPING_METHODS, shippingCostById } from "@/lib/shipping";
import { quoteVat } from "@/lib/vat";
import type { Database, Json } from "@/lib/database.types";

type Payment = Database["public"]["Tables"]["payments"]["Row"];

export function parsePaymentPayload(raw: Json | null): DpoPaymentPayload | null {
  return isDpoPaymentPayload(raw) ? raw : null;
}

export async function createOrderFromPayment(payment: Payment): Promise<string | null> {
  if (payment.order_id) return payment.order_id;

  const payload = parsePaymentPayload(payment.payload);
  if (!payload?.lines.length) return null;

  const admin = createAdminClient();
  const { data: latest } = await admin
    .from("payments")
    .select("order_id")
    .eq("id", payment.id)
    .maybeSingle();
  if (latest?.order_id) return latest.order_id;

  const orderId = `RSH${crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()}`;
  const shipping = SHIPPING_METHODS.find((method) => method.id === payload.shippingMethod);
  const shippingLabel = shipping?.name ?? payload.shippingMethod;
  const shippingCost = shippingCostById(payload.shippingMethod);
  const subtotal = payload.lines.reduce((sum, line) => sum + line.price * line.qty, 0);
  const vat = quoteVat(payload.country, subtotal + shippingCost);

  const { error: orderError } = await admin.from("orders").insert({
    id: orderId,
    user_id: payload.userId || payment.user_id,
    email: payload.email,
    full_name: payload.name,
    phone: typeof payload.phone === "string" && payload.phone.trim() ? payload.phone.trim() : null,
    address: payload.address,
    city: payload.city,
    country: vat.country || payload.country,
    shipping_method: shippingLabel,
    shipping_cost: shippingCost,
    subtotal,
    vat_rate: vat.rate,
    vat_amount: vat.amount,
    total: vat.total,
    notes: payload.notes || null,
    status: "reserved",
  });

  if (orderError) {
    const { data: raced } = await admin
      .from("payments")
      .select("order_id")
      .eq("id", payment.id)
      .maybeSingle();
    if (raced?.order_id) return raced.order_id;
    throw new Error(orderError.message);
  }

  const codes = [...new Set(payload.lines.map((line) => line.code))];
  const { data: products } = await admin.from("products").select("id, code").in("code", codes);
  const productIds = new Map((products ?? []).map((row) => [row.code, row.id]));

  const { error: itemsError } = await admin.from("order_items").insert(
    payload.lines.map((line) => ({
      order_id: orderId,
      product_id: productIds.get(line.code) ?? null,
      code: line.code,
      name: line.name,
      size: line.size,
      qty: line.qty,
      unit_price: line.price,
    })),
  );
  if (itemsError) throw new Error(itemsError.message);

  for (const line of payload.lines) {
    const productId = productIds.get(line.code);
    if (!productId) continue;
    const { data: sizeRow } = await admin
      .from("product_sizes")
      .select("id, stock")
      .eq("product_id", productId)
      .eq("size", line.size)
      .maybeSingle();
    if (!sizeRow) continue;
    await admin
      .from("product_sizes")
      .update({ stock: Math.max(0, Number(sizeRow.stock) - line.qty) })
      .eq("id", sizeRow.id);
  }

  await admin.from("payments").update({ order_id: orderId }).eq("id", payment.id).is("order_id", null);

  const { data: linked } = await admin
    .from("payments")
    .select("order_id")
    .eq("id", payment.id)
    .maybeSingle();
  return linked?.order_id ?? orderId;
}
