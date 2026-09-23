import { NextResponse } from "next/server";
import {
  cartDescription,
  cartShippingCost,
  cartSubtotal,
  CartResolveError,
  parseShippingMethod,
  resolveCheckoutLines,
} from "@/lib/dpo-cart";
import type { DpoPaymentPayload } from "@/lib/dpo-payload";
import {
  createToken,
  dpoCurrency,
  dpoPaymentUrl,
  formatDpoNetworkError,
  requestSiteUrl,
  splitName,
} from "@/lib/dpo";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { defaultVatCountry, quoteVat, resolveVatCountry } from "@/lib/vat";

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
    lines?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in to place an order." }, { status: 401 });
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
  const vatCountry = resolveVatCountry(String(body.country ?? "")) ?? (pickup ? resolveVatCountry(defaultVatCountry()) : null);
  if (!address || !city || !vatCountry) {
    return NextResponse.json({ error: "Complete shipping details." }, { status: 400 });
  }
  const country = vatCountry.name;

  let lines;
  try {
    lines = resolveCheckoutLines(body.lines);
  } catch (err) {
    if (err instanceof CartResolveError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Could not price the cart." }, { status: 400 });
  }

  const shippingCost = cartShippingCost(shippingMethod);
  const net = cartSubtotal(lines) + shippingCost;
  const vat = quoteVat(country, net);
  const amount = vat.total;
  if (amount <= 0) {
    return NextResponse.json({ error: "Cart total must be greater than zero." }, { status: 400 });
  }

  const companyRef = `RSH-${crypto.randomUUID().replace(/-/g, "").slice(0, 16).toUpperCase()}`;
  const { firstName, lastName } = splitName(name);
  const currency = dpoCurrency();
  const description = cartDescription(lines, companyRef);
  const payload: DpoPaymentPayload = {
    userId: user.id,
    email,
    name,
    phone,
    address,
    city,
    country,
    shippingMethod,
    shippingCost,
    vatRate: vat.rate,
    vatAmount: vat.amount,
    notes: String(body.notes ?? "").trim(),
    lines,
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
  });
}
