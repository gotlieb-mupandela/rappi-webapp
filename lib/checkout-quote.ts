import { blackFridayOffer, type BlackFridayOffer } from "@/lib/black-friday";
import { mergePricedLines } from "@/lib/checkout-lines";
import type { DiscountRate } from "@/lib/discount";
import { dealLines, type DpoCartLine } from "@/lib/dpo-payload";
import { dpoCurrency } from "@/lib/dpo-currency";
import { shippingCostById } from "@/lib/shipping";
import { defaultVatCountry, quoteVat, resolveVatCountry, roundMoney } from "@/lib/vat";

export type CheckoutQuoteItem = {
  code: string;
  size: string;
  qty: number;
  unitPrice: number;
  lineTotal: number;
};

export type CheckoutDiscount = {
  code: string;
  rate: number;
  amount: number;
};

export type CheckoutQuote = {
  items: CheckoutQuoteItem[];
  subtotal: number;
  shipping: number;
  /** Customer's discount code, applied after the Black Friday discount. */
  discount: CheckoutDiscount | null;
  /** Black Friday gifts and money off. Null when nothing applies. */
  blackFriday: BlackFridayOffer | null;
  vat: {
    rate: number;
    amount: number;
  };
  total: number;
  currency: string;
};

export type BagPrices = {
  items: CheckoutQuoteItem[];
  subtotal: number;
  currency: string;
};

export function merchandiseSubtotal(lines: Array<{ price: number; qty: number }>) {
  return lines.reduce((sum, line) => sum + line.price * line.qty, 0);
}

/**
 * Country used for VAT on a checkout quote and on DPO create.
 * Pickup with an empty or unknown country falls back to Namibia.
 */
export function resolveCheckoutCountry(country: unknown, shippingMethod: string) {
  return (
    resolveVatCountry(String(country ?? "")) ??
    (shippingMethod === "pickup" ? resolveVatCountry(defaultVatCountry()) : null)
  );
}

function quoteItems(lines: DpoCartLine[]): CheckoutQuoteItem[] {
  return lines.map((line) => ({
    code: line.code,
    size: line.size,
    qty: line.qty,
    unitPrice: line.price,
    lineTotal: roundMoney(line.price * line.qty),
  }));
}

/** Percent off the merchandise subtotal. Shipping is unchanged. */
function merchandiseDiscount(
  subtotal: number,
  discount: DiscountRate | null,
): CheckoutDiscount | null {
  if (!discount) return null;
  const code = discount.code.trim();
  const rate = Number(discount.rate);
  if (!code || !Number.isFinite(rate) || rate <= 0) return null;
  const bounded = Math.min(rate, 100);
  const base = roundMoney(subtotal);
  const amount = Math.min(base, roundMoney(base * (bounded / 100)));
  if (amount <= 0) return null;
  return { code, rate: bounded, amount };
}

/**
 * Payable checkout totals. DPO createToken charges `total`
 * (PaymentAmount is total with two decimal places). The quote route and
 * the create route both call this function.
 */
export function checkoutPaymentQuote(
  lines: DpoCartLine[],
  shippingMethod: string,
  country: string,
  currency = dpoCurrency(),
  discount: DiscountRate | null = null,
  now = Date.now(),
  promotions = true,
): CheckoutQuote {
  const merged = mergePricedLines(lines);
  const subtotal = merchandiseSubtotal(merged);
  const shipping = shippingCostById(shippingMethod);
  // Layby uses normal prices: no Black Friday gifts or money-off (Terms clause 7).
  const offer = promotions
    ? blackFridayOffer(dealLines(merged), now)
    : { gifts: [], discounts: [], discountTotal: 0 };
  // A discount code never stacks with Black Friday money-off deals: the bigger
  // saving wins, so stacked deals can never push an order below cost. Gifts stay.
  let deals = offer;
  let applied = merchandiseDiscount(subtotal, discount);
  if (applied && offer.discountTotal > 0) {
    if (applied.amount > offer.discountTotal) deals = { ...offer, discounts: [], discountTotal: 0 };
    else applied = { ...applied, amount: 0 };
  }
  const blackFriday = deals.gifts.length || deals.discountTotal > 0 ? deals : null;
  const off = deals.discountTotal + (applied?.amount ?? 0);
  // No-discount quotes keep the previous taxable base so cent totals stay put.
  const taxable = off > 0 ? roundMoney(subtotal - off + shipping) : subtotal + shipping;
  const vat = quoteVat(country, taxable);
  return {
    items: quoteItems(merged),
    subtotal: roundMoney(subtotal),
    shipping,
    discount: applied,
    blackFriday,
    vat: { rate: vat.rate, amount: vat.amount },
    total: vat.total,
    currency,
  };
}

/** Layby quote: normal prices, no discount code, no Black Friday deals. */
export function laybyPaymentQuote(lines: DpoCartLine[], shippingMethod: string, country: string) {
  return checkoutPaymentQuote(lines, shippingMethod, country, dpoCurrency(), null, Date.now(), false);
}

/**
 * Merchandise prices for the signed-in bag. Uses the same quote function as
 * DPO. Shipping and VAT are omitted because the bag has no ship-to country yet.
 * Pickup and Namibia do not change unit prices or the merchandise subtotal.
 */
export function bagPrices(lines: DpoCartLine[], currency = dpoCurrency()): BagPrices {
  const quote = checkoutPaymentQuote(lines, "pickup", "Namibia", currency);
  return {
    items: quote.items,
    subtotal: quote.subtotal,
    currency: quote.currency,
  };
}
