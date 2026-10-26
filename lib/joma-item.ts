import type { Product } from "@/lib/types";

/**
 * Second token that the shop section title drops (colour, audience, or edition mark).
 * Kept in lockstep with the product grid so public `line` is the heading shoppers see.
 */
const SECTION_STOP =
  /^(dark|light|neon|navy|black|white|red|blue|green|grey|gray|orange|yellow|pink|purple|beige|brown|soft|shell|polar|fleece|jacket|anorak|man|woman|junior|ii|iii|iv|v|vi|vii|viii)$/i;

/** Whole-word supplier token. Never copied into a public line label. */
const SUPPLIER_TOKEN = /^joma$/i;

/** Joiner kept between two words. A public line must not end on one of these. */
const LINE_SEPARATOR = /^(?:&|\/|-)$/;

/**
 * Price bracket such as "3.99 - 4.99". A heading that starts this way is hidden
 * so the shop and the app fall back to "More". "1-4 Years" does not match.
 */
const PRICE_BRACKET = /^\d+\.\d/;

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
 * Same short title the shop grid uses for a line section:
 * drop the trailing [n], drop the supplier token, keep the first word and the
 * second word unless it is a colour or edition stop. When that second word is
 * a separator (&, /, -), also keep the word after it. The stop-word rule
 * applies to that third word only: if it is a stop word, or there is no third
 * word, drop the separator and keep the first word. Title-case the result.
 * A result that opens with a price bracket (digits, a dot, then a digit)
 * returns "" so clients fall back to their own "More". An empty source
 * returns "" for the same reason.
 */
export function productLineLabel(item: string | null | undefined): string {
  const fam = normalizeFamily(item || "");
  if (!fam) return "";
  const tokens = fam.split(" ").filter((token) => token && !SUPPLIER_TOKEN.test(token));
  if (!tokens.length) return "";
  const kept = [tokens[0]];
  const second = tokens[1];
  if (second && !SECTION_STOP.test(second)) {
    if (LINE_SEPARATOR.test(second)) {
      const third = tokens[2];
      if (third && !SECTION_STOP.test(third)) kept.push(second, third);
    } else {
      kept.push(second);
    }
  }
  while (kept.length > 0 && LINE_SEPARATOR.test(kept[kept.length - 1])) kept.pop();
  if (!kept.length) return "";
  const label = titleCase(kept.join(" "));
  if (PRICE_BRACKET.test(label)) return "";
  return label;
}

export function productLineOf(product: Pick<Product, "item" | "line">) {
  if (typeof product.line === "string") return product.line;
  return productLineLabel(product.item);
}
