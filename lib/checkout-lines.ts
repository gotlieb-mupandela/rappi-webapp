import type { DpoCartLine } from "@/lib/dpo-payload";
import { buyableSizes } from "@/lib/product-stock";
import { SHIPPING_METHODS } from "@/lib/shipping";
import type { Product } from "@/lib/types";

export class CartResolveError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export type CheckoutLineRequest = {
  code: string;
  size: string;
  qty: number;
};

export function parseQty(value: unknown) {
  const qty = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(qty) || qty < 1 || qty > 99) return null;
  return qty;
}

export function parseShippingMethod(value: unknown) {
  const id = String(value ?? "");
  return SHIPPING_METHODS.some((method) => method.id === id) ? id : null;
}

/**
 * Reads code, size, and qty only. Client price fields are ignored.
 */
export function parseCheckoutLineInput(input: unknown): CheckoutLineRequest[] {
  if (!Array.isArray(input) || input.length === 0) {
    throw new CartResolveError(400, "Cart is empty.");
  }
  if (input.length > 50) {
    throw new CartResolveError(400, "Too many items in the cart.");
  }

  const parsed: CheckoutLineRequest[] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== "object") {
      throw new CartResolveError(400, "Invalid cart line.");
    }
    const row = raw as { code?: unknown; size?: unknown; qty?: unknown };
    const code = String(row.code ?? "").trim();
    const size = String(row.size ?? "").trim();
    const qty = parseQty(row.qty);
    if (!code || !size || !qty) {
      throw new CartResolveError(400, "Each item needs a product, size, and quantity.");
    }
    parsed.push({ code, size, qty });
  }
  return parsed;
}

function priceLine(product: Product, size: string, qty: number): DpoCartLine {
  if (product.available === false) {
    throw new CartResolveError(400, `Product ${product.code} is no longer sold.`);
  }
  const sizeRow = buyableSizes(product).find((option) => option.size === size);
  if (!sizeRow) {
    throw new CartResolveError(400, `Size ${size} is not available for ${product.code}.`);
  }
  if (sizeRow.stock < qty) {
    throw new CartResolveError(
      400,
      `Only ${sizeRow.stock} in stock for ${product.code} size ${size}.`,
    );
  }
  const price = Number(product.price);
  if (!(Number.isFinite(price) && price > 0)) {
    throw new CartResolveError(400, `Product ${product.code} has an invalid price.`);
  }
  return {
    code: product.code,
    name: product.displayName || product.name,
    size: sizeRow.size,
    qty,
    price,
  };
}

/** Prices parsed lines from catalog products. Unknown codes are rejected. */
export function priceCheckoutLines(
  parsed: CheckoutLineRequest[],
  products: Map<string, Product>,
): DpoCartLine[] {
  const lines: DpoCartLine[] = [];
  const missing: string[] = [];
  for (const row of parsed) {
    const product = products.get(row.code);
    if (!product) {
      if (!missing.includes(row.code)) missing.push(row.code);
      continue;
    }
    lines.push(priceLine(product, row.size, row.qty));
  }
  if (missing.length) {
    throw new CartResolveError(400, `Product ${missing.join(", ")} was not found.`);
  }
  if (!lines.length) {
    throw new CartResolveError(400, "Cart is empty.");
  }
  return lines;
}
