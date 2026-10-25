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

/** JSON numbers only. Strings, booleans, null, floats, and NaN are rejected. */
export function parseQty(value: unknown) {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > 99) return null;
  return value;
}

function lineKey(code: string, size: string) {
  return `${code}\0${size}`;
}

/** Same code and size become one line. A summed quantity above 99 is rejected. */
export function mergeCheckoutLineRequests(lines: CheckoutLineRequest[]): CheckoutLineRequest[] {
  const order: string[] = [];
  const merged = new Map<string, CheckoutLineRequest>();
  for (const line of lines) {
    const key = lineKey(line.code, line.size);
    const prev = merged.get(key);
    if (!prev) {
      merged.set(key, { code: line.code, size: line.size, qty: line.qty });
      order.push(key);
      continue;
    }
    prev.qty += line.qty;
  }
  return order.map((key) => {
    const line = merged.get(key)!;
    if (!Number.isInteger(line.qty) || line.qty < 1 || line.qty > 99) {
      throw new CartResolveError(
        400,
        `Quantity for ${line.code} size ${line.size} must be from 1 to 99.`,
      );
    }
    return line;
  });
}

/** Priced lines returned by the quote. Same code and size keep one unit price. */
export function mergePricedLines(lines: DpoCartLine[]): DpoCartLine[] {
  const order: string[] = [];
  const merged = new Map<string, DpoCartLine>();
  for (const line of lines) {
    const key = lineKey(line.code, line.size);
    const prev = merged.get(key);
    if (!prev) {
      merged.set(key, { ...line });
      order.push(key);
      continue;
    }
    if (prev.price !== line.price) {
      throw new CartResolveError(400, `Product ${line.code} has an invalid price.`);
    }
    prev.qty += line.qty;
  }
  return order.map((key) => {
    const line = merged.get(key)!;
    if (!Number.isInteger(line.qty) || line.qty < 1 || line.qty > 99) {
      throw new CartResolveError(
        400,
        `Quantity for ${line.code} size ${line.size} must be from 1 to 99.`,
      );
    }
    return line;
  });
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

/**
 * Prices parsed lines from catalog products. Duplicate code and size rows are
 * merged before the stock check. Unknown codes are rejected.
 */
export function priceCheckoutLines(
  parsed: CheckoutLineRequest[],
  products: Map<string, Product>,
): DpoCartLine[] {
  const rows = mergeCheckoutLineRequests(parsed);
  const lines: DpoCartLine[] = [];
  const missing: string[] = [];
  for (const row of rows) {
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
