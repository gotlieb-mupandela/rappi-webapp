export type DpoCartLine = {
  code: string;
  name: string;
  size: string;
  qty: number;
  price: number;
};

export type DpoPaymentPayload = {
  userId: string;
  email: string;
  name: string;
  address: string;
  city: string;
  country: string;
  shippingMethod: string;
  shippingCost: number;
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
  );
}
