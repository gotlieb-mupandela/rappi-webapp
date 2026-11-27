import "server-only";

import {
  DiscountCodeError,
  DiscountLookupError,
  isDiscountCodeShape,
  normalizeDiscountCode,
  type DiscountRate,
} from "@/lib/discount";
import { COUPON_CODE, couponStatus } from "@/lib/opening";
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
  if (!data) return openingCoupon(admin, code);

  const rate = Number(data.rate);
  if (!Number.isFinite(rate) || rate <= 0 || rate > 100) throw new DiscountCodeError();
  return { code: data.code, rate };
}

/** Personal store-opening coupons work online too: one use, only inside their dates. */
async function openingCoupon(admin: ReturnType<typeof createAdminClient>, code: string): Promise<DiscountRate> {
  if (!COUPON_CODE.test(code)) throw new DiscountCodeError();
  const { data, error } = await admin
    .from("opening_coupons")
    .select("code, rate, redeemed_at, valid_from, valid_until")
    .eq("code", code)
    .maybeSingle();
  if (error) {
    console.error("opening coupon lookup", error.message);
    throw new DiscountLookupError();
  }
  if (!data || couponStatus(data) !== "valid") throw new DiscountCodeError();
  return { code: data.code, rate: Number(data.rate) };
}
