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
  requestSiteUrl,
  splitName,
} from "@/lib/dpo";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: {
    name?: string;
    email?: string;
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
  if (!name || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Enter a name and a valid email." }, { status: 400 });
  }

  const shippingMethod = parseShippingMethod(body.shippingMethod);
  if (!shippingMethod) {
    return NextResponse.json({ error: "Choose a shipping method." }, { status: 400 });
  }

  const pickup = shippingMethod === "pickup";
  const address = String(body.address ?? "").trim() || (pickup ? "Hub pickup" : "");
  const city = String(body.city ?? "").trim() || (pickup ? "—" : "");
  const country = String(body.country ?? "").trim() || (pickup ? "NA" : "");
  if (!address || !city || !country) {
    return NextResponse.json({ error: "Complete shipping details." }, { status: 400 });
  }

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
  const amount = cartSubtotal(lines) + shippingCost;
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
    address,
    city,
    country,
    shippingMethod,
    shippingCost,
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
      customer: { firstName, lastName, email },
      siteUrl: requestSiteUrl(req),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not start payment." },
      { status: 500 },
    );
  }

  if (created.result !== "000" || !created.transToken) {
    return NextResponse.json(
      {
        error:
          created.explanation ??
          `DPO createToken failed (${created.result ?? "no result"}).`,
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
