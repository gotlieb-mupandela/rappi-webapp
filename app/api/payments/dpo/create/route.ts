import { NextResponse } from "next/server";
import { blackFridayOrderNote } from "@/lib/black-friday";
import { checkoutPaymentQuote, laybyPaymentQuote, resolveCheckoutCountry, type CheckoutQuote } from "@/lib/checkout-quote";
import { laybyEligible, laybyPlan, LAYBY } from "@/lib/layby";
import { discountRouteError } from "@/lib/discount";
import { resolveActiveDiscount } from "@/lib/discount-lookup";
import {
  cartDescription,
  CartResolveError,
  parseShippingMethod,
  resolveCheckoutLines,
} from "@/lib/dpo-cart";
import { dealLines, type DpoPaymentPayload } from "@/lib/dpo-payload";
import {
  createToken,
  dpoPaymentUrl,
  formatDpoNetworkError,
  requestSiteUrl,
  splitName,
} from "@/lib/dpo";
import { consumeRateLimit } from "@/lib/rate-limit";
import { roundMoney } from "@/lib/vat";
import { createAdminClient } from "@/lib/supabase/admin";
import { createRequestClient } from "@/lib/supabase/request";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  let body: {
    name?: string;
    email?: string;
    phone?: string;
    address?: string;
    city?: string;
    country?: string;
    notes?: string;
    shippingMethod?: string;
    discountCode?: unknown;
    lines?: unknown;
    /** Open a layby: pay the 20% deposit today. */
    layby?: unknown;
    acceptLayby?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const supabase = await createRequestClient(req);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in to place an order." }, { status: 401 });
  }

  const allowed = await consumeRateLimit(`dpo-create:${user.id}`, 10);
  if (!allowed) {
    return NextResponse.json({ error: "Too many payment attempts. Try again later." }, { status: 429 });
  }

  const name = String(body.name ?? "").trim();
  const email = String(body.email ?? "").trim();
  const phone = String(body.phone ?? "").trim();
  if (!name || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Enter a name and a valid email." }, { status: 400 });
  }
  if (!phone || !/^\+?[\d\s().-]{7,20}$/.test(phone)) {
    return NextResponse.json({ error: "Enter a valid cell phone number." }, { status: 400 });
  }

  const shippingMethod = parseShippingMethod(body.shippingMethod);
  if (!shippingMethod) {
    return NextResponse.json({ error: "Choose a shipping method." }, { status: 400 });
  }

  const pickup = shippingMethod === "pickup";
  const address = String(body.address ?? "").trim() || (pickup ? "Hub pickup" : "");
  const city = String(body.city ?? "").trim() || (pickup ? "—" : "");
  const vatCountry = resolveCheckoutCountry(body.country, shippingMethod);
  if (!address || !city || !vatCountry) {
    return NextResponse.json({ error: "Complete shipping details." }, { status: 400 });
  }
  const country = vatCountry.name;

  const layby = body.layby === true;
  if (layby && body.acceptLayby !== true) {
    return NextResponse.json({ error: "Please accept the layby agreement to continue." }, { status: 400 });
  }

  let lines;
  let quote;
  try {
    const [discount, pricedLines] = await Promise.all([
      layby ? Promise.resolve(null) : resolveActiveDiscount(body.discountCode),
      resolveCheckoutLines(body.lines),
    ]);
    lines = pricedLines;
    quote = layby
      ? laybyPaymentQuote(lines, shippingMethod, country)
      : checkoutPaymentQuote(lines, shippingMethod, country, undefined, discount);
  } catch (err) {
    const discountError = discountRouteError(err);
    if (discountError) {
      return NextResponse.json({ error: discountError.error }, { status: discountError.status });
    }
    if (err instanceof CartResolveError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Could not price the cart." }, { status: 400 });
  }

  if (layby && !laybyEligible({ merchandise: quote.subtotal, currency: quote.currency })) {
    return NextResponse.json(
      { error: `Layby is available on orders of N$${LAYBY.MIN_ORDER} or more, paid in Namibian dollars.` },
      { status: 400 },
    );
  }
  const plan = layby ? laybyPlan(quote.total) : null;
  const amount = plan ? plan.deposit : quote.total;
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "Cart total must be greater than zero." }, { status: 400 });
  }

  const companyRef = `RSH-${crypto.randomUUID().replace(/-/g, "").slice(0, 16).toUpperCase()}`;
  const { firstName, lastName } = splitName(name);
  const currency = quote.currency;
  const description = plan ? `Layby deposit (20%) ${companyRef}` : cartDescription(lines, companyRef);
  const payload: DpoPaymentPayload = {
    userId: user.id,
    email,
    name,
    phone,
    address,
    city,
    country,
    shippingMethod,
    shippingCost: quote.shipping,
    vatRate: quote.vat.rate,
    vatAmount: quote.vat.amount,
    ...(plan ? {} : storedDiscount(quote)),
    notes: [String(body.notes ?? "").trim(), plan ? "" : blackFridayOrderNote(dealLines(lines))].filter(Boolean).join("\n\n"),
    lines,
    ...(plan
      ? {
          layby: {
            kind: "deposit" as const,
            total: quote.total,
            deposit: plan.deposit,
            acceptedAt: new Date().toISOString(),
            ip: (req.headers.get("x-forwarded-for") ?? "").split(",")[0]?.trim() || undefined,
          },
        }
      : {}),
  };

  let created;
  try {
    created = await createToken({
      companyRef,
      amount,
      currency,
      description,
      customer: { firstName, lastName, email, phone, address, city, country },
      siteUrl: requestSiteUrl(req),
    });
  } catch (err) {
    return NextResponse.json(
      { error: formatDpoNetworkError(err) },
      { status: 500 },
    );
  }

  if (created.result !== "000" || !created.transToken) {
    const explanation = created.explanation?.trim() || "";
    return NextResponse.json(
      {
        error:
          created.result === "802" || /company token does not exist|company is not active/i.test(explanation)
            ? "DPO company token does not exist or is not active. Use the live token from DPO onboarding, or the sandbox token from their docs."
            : explanation || `DPO createToken failed (${created.result ?? "no result"}).`,
      },
      { status: 400 },
    );
  }

  try {
    const admin = createAdminClient();
    const { error } = await admin.from("payments").insert({
      provider: "dpo",
      company_ref: companyRef,
      trans_token: created.transToken,
      trans_ref: created.transRef,
      product_code: lines[0]?.code ?? "CART",
      amount,
      currency,
      status: "pending",
      customer_email: email,
      customer_name: name,
      user_id: user.id,
      payload,
    });
    if (error) {
      return NextResponse.json({ error: "Could not record payment." }, { status: 500 });
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not record payment." },
      { status: 500 },
    );
  }

  return NextResponse.json({
    paymentUrl: dpoPaymentUrl(created.transToken),
    companyRef,
    transToken: created.transToken,
    items: quote.items,
    subtotal: quote.subtotal,
    shipping: quote.shipping,
    discount: quote.discount,
    vat: quote.vat,
    total: quote.total,
    currency: quote.currency,
    ...(plan ? { layby: { deposit: plan.deposit, balance: plan.balance, finalDue: plan.finalDue.toISOString() } } : {}),
  });
}

/**
 * The order keeps one discount: the customer's code when they used one (so
 * code usage counts stay right), otherwise BLACKFRIDAY. The amount covers both.
 */
function storedDiscount(quote: CheckoutQuote) {
  const deals = quote.blackFriday?.discountTotal ?? 0;
  const amount = roundMoney(deals + (quote.discount?.amount ?? 0));
  if (amount <= 0) return { discountCode: "", discountRate: 0, discountAmount: 0 };
  if (quote.discount && quote.discount.amount > 0)
    return { discountCode: quote.discount.code, discountRate: quote.discount.rate, discountAmount: amount };
  return {
    discountCode: "BLACKFRIDAY",
    discountRate: Math.min(100, roundMoney((deals / quote.subtotal) * 100)),
    discountAmount: amount,
  };
}
