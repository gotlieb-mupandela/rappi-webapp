import { revalidateCatalog } from "@/lib/admin/revalidate-catalog";
import { createAdminClient } from "@/lib/supabase/admin";
import { isDpoPaymentPayload, type DpoPaymentPayload } from "@/lib/dpo-payload";
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
  const { data, error } = await admin.rpc("fulfill_paid_payment", {
    p_payment_id: payment.id,
  });
  if (error) throw new Error(error.message);
  if (data) revalidateCatalog();
  return data ?? null;
}
