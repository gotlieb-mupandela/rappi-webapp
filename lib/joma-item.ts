import type { Product } from "@/lib/types";

/**
 * Public product-line label.
 * The supplier-field branch owns the real heading rules.
 * This branch returns "" so the feed emits null until that branch is stacked.
 * The argument is accepted so the call matches that export.
 */
export function productLineLabel(item: string | null | undefined): string {
  void item;
  return "";
}

/** Normalized supplier `item` family (drops trailing [n] pack markers). */
export function itemFamilyOf(product: Pick<Product, "item">) {
  return String(product.item || "")
    .replace(/\s*\[\d+\]\s*$/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}
