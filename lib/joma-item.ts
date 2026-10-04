import type { Product } from "@/lib/types";

/** Normalized Joma `item` family (drops trailing [n] pack markers). */
export function itemFamilyOf(product: Pick<Product, "item">) {
  return String(product.item || "")
    .replace(/\s*\[\d+\]\s*$/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}
