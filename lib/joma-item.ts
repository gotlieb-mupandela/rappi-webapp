import type { Product } from "@/lib/types";

/**
 * Second token that the shop section title drops (colour, audience, or edition mark).
 * Kept in lockstep with the product grid so public `line` is the heading shoppers see.
 */
const SECTION_STOP =
  /^(dark|light|neon|navy|black|white|red|blue|green|grey|gray|orange|yellow|pink|purple|beige|brown|soft|shell|polar|fleece|jacket|anorak|man|woman|junior|ii|iii|iv|v|vi|vii|viii)$/i;

/** Whole-word supplier token. Never copied into a public line label. */
const SUPPLIER_TOKEN = /^joma$/i;

/** Normalized supplier `item` family (drops a trailing [n] pack marker). Server use only. */
export function itemFamilyOf(product: Pick<Product, "item">) {
  return normalizeFamily(product.item || "");
}

function normalizeFamily(item: string) {
  return String(item || "")
    .replace(/\s*\[\d+\]\s*$/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

function titleCase(value: string) {
  return value.replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Public product-line label.
 * Same one-or-two-word title the shop grid uses for a line section:
 * drop the trailing [n], drop the supplier token, keep the first word and the
 * second word unless it is a colour or edition stop, then title-case.
 * An empty source returns "" so clients can fall back to their own "More".
 */
export function productLineLabel(item: string | null | undefined): string {
  const fam = normalizeFamily(item || "");
  if (!fam) return "";
  const tokens = fam.split(" ").filter((token) => token && !SUPPLIER_TOKEN.test(token));
  if (!tokens.length) return "";
  const out = [tokens[0]];
  if (tokens[1] && !SECTION_STOP.test(tokens[1])) out.push(tokens[1]);
  return titleCase(out.join(" "));
}

export function productLineOf(product: Pick<Product, "item" | "line">) {
  if (typeof product.line === "string") return product.line;
  return productLineLabel(product.item);
}
