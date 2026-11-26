export type DpoCartLine = {
  code: string;
  name: string;
  size: string;
  qty: number;
  price: number;
  /** Catalogue fields that decide Black Friday deals. Set when lines are priced on the server. */
  deal?: { name: string; category: string; subcategory: string };
};

/** Lines that carry catalogue fields, in the shape the Black Friday offer reads. */
export function dealLines(lines: DpoCartLine[]) {
  return lines.flatMap((l) =>
    l.deal ? [{ code: l.code, qty: l.qty, price: l.price, ...l.deal }] : [],
  );
}

export type DpoPaymentPayload = {
  userId: string;
  email: string;
  name: string;
  phone?: string;
  address: string;
  city: string;
  country: string;
  shippingMethod: string;
  shippingCost: number;
  vatRate?: number;
  vatAmount?: number;
  discountCode?: string;
  discountRate?: number;
  discountAmount?: number;
  notes: string;
  lines: DpoCartLine[];
};

export function isDpoPaymentPayload(value: unknown): value is DpoPaymentPayload {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.userId === "string" &&
    typeof row.email === "string" &&
    typeof row.name === "string" &&
    typeof row.address === "string" &&
    typeof row.city === "string" &&
    typeof row.country === "string" &&
    typeof row.shippingMethod === "string" &&
    typeof row.shippingCost === "number" &&
    Array.isArray(row.lines)
    // phone / vatRate / vatAmount optional on older pending payments
  );
}
