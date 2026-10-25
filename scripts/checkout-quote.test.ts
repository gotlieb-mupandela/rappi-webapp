import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { bagPrices, checkoutPaymentQuote, resolveCheckoutCountry } from "../lib/checkout-quote";
import {
  CartResolveError,
  parseCheckoutLineInput,
  parseShippingMethod,
  priceCheckoutLines,
} from "../lib/checkout-lines";
import { buildCreateTokenXml, xmlTag } from "../lib/dpo-xml";
import type { DpoCartLine } from "../lib/dpo-payload";
import { escapeHtml } from "../lib/html-escape";
import type { Product } from "../lib/types";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function fail(msg: string) {
  console.error(`FAIL ${msg}`);
  process.exitCode = 1;
}

function product(code: string, price: number, size = "M", stock = 20): Product {
  return {
    id: code,
    code,
    item: code,
    title: code,
    name: code,
    displayName: code,
    category: "football",
    subcategory: "tees",
    gender: "unisex",
    price,
    unitPrice: price,
    currency: "NAD",
    sheetCategory: null,
    totalQty: stock,
    stockQty: stock,
    badge: null,
    sizeOptions: [size],
    sizes: [{ size, stock }],
    imageUrl: "/x.webp",
    images: ["/x.webp"],
  };
}

function line(code: string, price: number, qty: number, size = "M"): DpoCartLine {
  return { code, name: code, size, qty, price };
}

function expectThrow(fn: () => unknown, message: string) {
  try {
    fn();
    fail(`expected throw: ${message}`);
  } catch (err) {
    if (!(err instanceof CartResolveError) || err.status !== 400) {
      fail(`${message} should be a 400 CartResolveError`);
    }
  }
}

const parsed = parseCheckoutLineInput([
  { code: "SKU1", size: "M", qty: 2, price: 1, unitPrice: 5, lineTotal: 9 },
]);
if (parsed.length !== 1 || parsed[0].code !== "SKU1" || parsed[0].qty !== 2) {
  fail("parser dropped a valid line");
}
if ("price" in parsed[0] || "unitPrice" in parsed[0] || "lineTotal" in parsed[0]) {
  fail("parser kept a client price");
}

const priced = priceCheckoutLines(parsed, new Map([["SKU1", product("SKU1", 304)]]));
if (priced[0].price !== 304) fail(`client price was trusted: ${priced[0].price}`);

expectThrow(() => parseCheckoutLineInput([]), "empty cart");
expectThrow(() => parseCheckoutLineInput([{ code: "A", size: "M", qty: 0 }]), "qty 0");
expectThrow(() => parseCheckoutLineInput([{ code: "A", size: "M", qty: 100 }]), "qty 100");
expectThrow(() => parseCheckoutLineInput([{ code: "A", size: "M", qty: 1.5 }]), "fractional qty");
expectThrow(
  () => parseCheckoutLineInput(Array.from({ length: 51 }, () => ({ code: "A", size: "M", qty: 1 }))),
  "51 lines",
);
expectThrow(
  () => priceCheckoutLines([{ code: "MISSING", size: "M", qty: 1 }], new Map()),
  "unknown code",
);

try {
  priceCheckoutLines([{ code: "SKU1", size: "<img>", qty: 1 }], new Map([["SKU1", product("SKU1", 10)]]));
  fail("bad size should throw");
} catch (err) {
  if (!(err instanceof CartResolveError)) fail("bad size error type");
  else if (escapeHtml(err.message).includes("<img>")) fail("size error was not escaped");
  else if (!escapeHtml(err.message).includes("&lt;img&gt;")) fail("escaped size missing");
}

if (parseShippingMethod("standard") !== "standard") fail("standard shipping");
if (parseShippingMethod("air") !== null) fail("unknown shipping should be rejected");
if (parseCheckoutLineInput([{ code: "A", size: "M", qty: "2" }])[0].qty !== 2) {
  fail("numeric string qty");
}

const carts: Array<{
  lines: DpoCartLine[];
  method: string;
  country: string;
  total: number;
  shipping: number;
  vatRate: number;
  vatAmount: number;
}> = [
  {
    lines: [line("A", 250, 2), line("B", 80, 1)],
    method: "standard",
    country: "Namibia",
    shipping: 100,
    vatRate: 15,
    vatAmount: 102,
    total: 782,
  },
  {
    lines: [line("C", 100, 1)],
    method: "express",
    country: "France",
    shipping: 150,
    vatRate: 20,
    vatAmount: 50,
    total: 300,
  },
  {
    lines: [line("D", 15.5, 2)],
    method: "pickup",
    country: "United States",
    shipping: 0,
    vatRate: 0,
    vatAmount: 0,
    total: 31,
  },
  {
    lines: [line("E", 40, 3)],
    method: "standard",
    country: "Finland",
    shipping: 100,
    vatRate: 25.5,
    vatAmount: 56.1,
    total: 276.1,
  },
  {
    lines: [line("F", 19, 1)],
    method: "express",
    country: "Cameroon",
    shipping: 150,
    vatRate: 19.25,
    vatAmount: 32.53,
    total: 201.53,
  },
];

const previousCurrency = process.env.DPO_CURRENCY;
process.env.DPO_CURRENCY = "USD";
try {
  for (const cart of carts) {
    const country = resolveCheckoutCountry(cart.country, cart.method);
    if (!country) fail(`country ${cart.country} did not resolve`);
    const quote = checkoutPaymentQuote(cart.lines, cart.method, country?.name ?? cart.country);
    if (quote.total !== cart.total) fail(`${cart.country} total ${quote.total} !== ${cart.total}`);
    if (quote.shipping !== cart.shipping) fail(`${cart.country} shipping ${quote.shipping}`);
    if (quote.vat.rate !== cart.vatRate || quote.vat.amount !== cart.vatAmount) {
      fail(`${cart.country} vat ${quote.vat.rate}/${quote.vat.amount}`);
    }
    if (quote.currency !== "USD") fail("quote currency did not follow DPO_CURRENCY");
    const xml = buildCreateTokenXml({
      companyToken: "test-token",
      serviceType: "1",
      companyRef: "RSH-TEST",
      amount: quote.total,
      currency: quote.currency,
      description: "quote test",
      serviceDate: "2026/10/25 12:00",
      customer: {
        firstName: "Test",
        lastName: "Buyer",
        email: "buyer@example.com",
        country: country?.name,
      },
      siteUrl: "https://www.rappisportshub.com",
    });
    const payloadAmount = xmlTag(xml, "PaymentAmount");
    if (payloadAmount !== quote.total.toFixed(2)) {
      fail(`PaymentAmount ${payloadAmount} !== quote.total ${quote.total.toFixed(2)}`);
    }
    if (Number(payloadAmount) !== quote.total) {
      fail(`PaymentAmount number ${payloadAmount} !== quote.total ${quote.total}`);
    }
    if (xmlTag(xml, "PaymentCurrency") !== quote.currency) fail("PaymentCurrency drifted");
    const bag = bagPrices(cart.lines);
    if (bag.subtotal !== quote.subtotal) fail("bag subtotal drifted from quote");
    if (bag.items.some((item, i) => item.unitPrice !== quote.items[i].unitPrice)) {
      fail("bag unit price drifted from quote");
    }
    if ("total" in bag || "shipping" in bag || "vat" in bag) fail("bag prices included checkout totals");
  }
} finally {
  if (previousCurrency === undefined) delete process.env.DPO_CURRENCY;
  else process.env.DPO_CURRENCY = previousCurrency;
}

const za = resolveCheckoutCountry("za", "standard");
if (za?.name !== "South Africa" || za.rate !== 15) fail("za alias");
const zaQuote = checkoutPaymentQuote([line("G", 10, 1)], "standard", za?.name ?? "");
if (zaQuote.total !== 126.5) fail(`za total ${zaQuote.total}`);

const pickupDefault = resolveCheckoutCountry("", "pickup");
if (pickupDefault?.name !== "Namibia") fail("pickup default country");
const pickupQuote = checkoutPaymentQuote([line("H", 10, 1)], "pickup", pickupDefault?.name ?? "");
if (pickupQuote.total !== 11.5 || pickupQuote.shipping !== 0) fail(`pickup default total ${pickupQuote.total}`);
if (resolveCheckoutCountry("", "express") !== null) fail("express requires a country");

const skuQuote = checkoutPaymentQuote(priced, "standard", "Namibia");
if (skuQuote.items[0].unitPrice !== 304 || skuQuote.total === 1) {
  fail("quote used a client price");
}

function source(path: string) {
  return readFileSync(join(root, path), "utf8");
}

const createRoute = source("app/api/payments/dpo/create/route.ts");
if (!createRoute.includes("const quote = checkoutPaymentQuote(lines, shippingMethod, country);")) {
  fail("create route does not call checkoutPaymentQuote");
}
if (!createRoute.includes("const amount = quote.total;")) {
  fail("create route does not charge quote.total");
}
if (!/createToken\(\{[\s\S]*amount,[\s\S]*currency,/.test(createRoute)) {
  fail("createToken is not called with the quote amount");
}
for (const field of ["items: quote.items", "subtotal: quote.subtotal", "shipping: quote.shipping", "vat: quote.vat", "total: quote.total", "currency: quote.currency"]) {
  if (!createRoute.includes(field)) fail(`create response missing ${field}`);
}
if (!createRoute.includes("paymentUrl:") || !createRoute.includes("companyRef,") || !createRoute.includes("transToken: created.transToken")) {
  fail("create response dropped an existing field");
}

const dpoSource = source("lib/dpo.ts");
if (!dpoSource.includes("buildCreateTokenXml(")) fail("createToken does not build XML with the shared helper");
if (dpoSource.includes("<PaymentAmount>")) fail("PaymentAmount is formatted outside the shared XML helper");

for (const path of ["app/api/checkout/quote/route.ts", "app/api/cart/prices/route.ts"]) {
  const text = source(path);
  const methods = [...text.matchAll(/export async function (GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)/g)].map(
    (match) => match[1],
  );
  if (methods.join(",") !== "POST") fail(`${path} methods: ${methods.join(",") || "none"}`);
  if (!text.includes("enforceCheckoutRateLimit")) fail(`${path} has no rate limit`);
  if (!text.includes("escapeHtml") && !text.includes("pricedCartError")) {
    fail(`${path} can reflect user input unescaped`);
  }
  if (text.includes("row.price") || text.includes("body.price") || text.includes("unitPrice:")) {
    fail(`${path} reads a client price`);
  }
}

const quoteRoute = source("app/api/checkout/quote/route.ts");
if (!quoteRoute.includes("checkoutPaymentQuote(lines, shippingMethod, vatCountry.name)")) {
  fail("quote route does not call checkoutPaymentQuote");
}
const pricesRoute = source("app/api/cart/prices/route.ts");
if (!pricesRoute.includes("bagPrices(lines)")) fail("bag route does not use bagPrices");

if (process.exitCode) {
  console.error("checkout quote tests failed");
} else {
  console.log("checkout quote tests passed");
}
