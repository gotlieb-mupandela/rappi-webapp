import { mergePricedLines } from "@/lib/checkout-lines";
import type { DpoCartLine } from "@/lib/dpo-payload";
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

export type CheckoutQuote = {
  items: CheckoutQuoteItem[];
  subtotal: number;
  shipping: number;
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
): CheckoutQuote {
  const merged = mergePricedLines(lines);
  const subtotal = merchandiseSubtotal(merged);
  const shipping = shippingCostById(shippingMethod);
  const vat = quoteVat(country, subtotal + shipping);
  return {
    items: quoteItems(merged),
    subtotal: roundMoney(subtotal),
    shipping,
    vat: { rate: vat.rate, amount: vat.amount },
    total: vat.total,
    currency,
  };
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
