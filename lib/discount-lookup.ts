import "server-only";

import {
  DiscountCodeError,
  DiscountLookupError,
  isDiscountCodeShape,
  normalizeDiscountCode,
  type DiscountRate,
} from "@/lib/discount";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Active code for checkout pricing. An empty value means no discount.
 * A wrong or inactive code is rejected so the charge cannot ignore a typed code.
 * The table is not readable by shoppers; this uses the service role.
 */
export async function resolveActiveDiscount(raw: unknown): Promise<DiscountRate | null> {
  const code = normalizeDiscountCode(raw);
  if (!code) return null;
  if (!isDiscountCodeShape(code)) throw new DiscountCodeError();

  let admin;
  try {
    admin = createAdminClient();
  } catch (err) {
    console.error("discount lookup", err instanceof Error ? err.message : "unavailable");
    throw new DiscountLookupError();
  }

  const { data, error } = await admin
    .from("discount_codes")
    .select("code, rate")
    .eq("code", code)
    .eq("active", true)
    .maybeSingle();

  if (error) {
    console.error("discount lookup", error.message);
    throw new DiscountLookupError();
  }
  if (!data) throw new DiscountCodeError();

  const rate = Number(data.rate);
  if (!Number.isFinite(rate) || rate <= 0 || rate > 100) throw new DiscountCodeError();
  return { code: data.code, rate };
}
