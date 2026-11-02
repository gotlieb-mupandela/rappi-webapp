/** Percent off merchandise. The rate is never taken from the browser. */
export type DiscountRate = {
  code: string;
  rate: number;
};

export class DiscountCodeError extends Error {
  constructor() {
    super("That discount code is not valid.");
  }
}

export class DiscountLookupError extends Error {
  constructor() {
    super("Could not check the discount code.");
  }
}

export function normalizeDiscountCode(value: unknown) {
  return String(value ?? "").trim().toUpperCase();
}

/** 2–32 letters, numbers, underscores, or hyphens. */
export function isDiscountCodeShape(code: string) {
  return /^[A-Z0-9][A-Z0-9_-]{1,31}$/.test(code);
}

/** Discount stored on a payment payload or an order row. Amount is the money taken off. */
export function readAppliedDiscount(value: unknown): { code: string; rate: number; amount: number } | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const amount = Number(row.discountAmount ?? row.discount_amount);
  const code = String(row.discountCode ?? row.discount_code ?? "").trim();
  const rate = Number(row.discountRate ?? row.discount_rate);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return {
    code,
    rate: Number.isFinite(rate) ? rate : 0,
    amount,
  };
}

export function discountRouteError(err: unknown): { error: string; status: number } | null {
  if (err instanceof DiscountCodeError) return { error: err.message, status: 400 };
  if (err instanceof DiscountLookupError) return { error: err.message, status: 500 };
  return null;
}
