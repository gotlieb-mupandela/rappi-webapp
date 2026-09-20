import "server-only";

import { buyableSizes } from "@/lib/product-stock";
import { getProduct } from "@/lib/products";
import { SHIPPING_METHODS, shippingCostById } from "@/lib/shipping";
import type { DpoCartLine } from "@/lib/dpo-payload";

export class CartResolveError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export function parseQty(value: unknown) {
  const qty = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(qty) || qty < 1 || qty > 99) return null;
  return qty;
}

export function parseShippingMethod(value: unknown) {
  const id = String(value ?? "");
  return SHIPPING_METHODS.some((method) => method.id === id) ? id : null;
}

export function resolveCheckoutLines(input: unknown): DpoCartLine[] {
  if (!Array.isArray(input) || input.length === 0) {
    throw new CartResolveError(400, "Cart is empty.");
  }
  if (input.length > 50) {
    throw new CartResolveError(400, "Too many items in the cart.");
  }

  const lines: DpoCartLine[] = [];
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

    const product = getProduct(code);
    if (!product) {
      throw new CartResolveError(400, `Product ${code} was not found.`);
    }

    const sizeRow = buyableSizes(product).find((option) => option.size === size);
    if (!sizeRow) {
      throw new CartResolveError(400, `Size ${size} is not available for ${code}.`);
    }
    if (sizeRow.stock < qty) {
      throw new CartResolveError(400, `Only ${sizeRow.stock} in stock for ${code} size ${size}.`);
    }

    lines.push({
      code: product.code,
      name: product.displayName || product.name,
      size: sizeRow.size,
      qty,
      price: Number(product.price),
    });
  }
  return lines;
}

export function cartSubtotal(lines: DpoCartLine[]) {
  return lines.reduce((sum, line) => sum + line.price * line.qty, 0);
}

export function cartShippingCost(methodId: string) {
  return shippingCostById(methodId);
}

export function cartDescription(lines: DpoCartLine[], companyRef: string) {
  const summary = lines.map((line) => `${line.code}×${line.qty}`).join(", ");
  const text = `${summary} ${companyRef}`.trim();
  return text.length > 180 ? `${text.slice(0, 177)}...` : text;
}
