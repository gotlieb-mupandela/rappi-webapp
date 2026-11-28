import { NextResponse } from "next/server";
import { createToken, dpoPaymentUrl, formatDpoNetworkError, requestSiteUrl, splitName } from "@/lib/dpo";
import { dpoCurrency } from "@/lib/dpo-currency";
import type { DpoPaymentPayload } from "@/lib/dpo-payload";
import { laybyBalance, laybyPaymentLimits, money, validLaybyPayment } from "@/lib/layby";
import { consumeRateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createRequestClient } from "@/lib/supabase/request";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Customer pays part of a layby balance by card (DPO). Body: { amount }. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = (await params).id.toUpperCase();
  let body: { amount?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const supabase = await createRequestClient(req);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to pay your layby." }, { status: 401 });

  const allowed = await consumeRateLimit(`layby-pay:${user.id}`, 10).catch(() => false);
  if (!allowed) return NextResponse.json({ error: "Too many payment attempts. Try again later." }, { status: 429 });

  const admin = createAdminClient();
  const { data: layby } = await admin.from("laybys").select("*").eq("id", id).maybeSingle();
  if (!layby || layby.user_id !== user.id) return NextResponse.json({ error: "Layby not found." }, { status: 404 });
  if (layby.status !== "active") {
    return NextResponse.json({ error: layby.status === "paid" ? "This layby is already paid." : "This layby was cancelled." }, { status: 400 });
  }

  const amount = money(Number(body.amount));
  if (!validLaybyPayment(layby, amount)) {
    const { min, max } = laybyPaymentLimits(layby);
    return NextResponse.json({ error: `Enter an amount from N$${min.toFixed(2)} to N$${max.toFixed(2)}.` }, { status: 400 });
  }

  const companyRef = `RSH-${crypto.randomUUID().replace(/-/g, "").slice(0, 16).toUpperCase()}`;
  const { firstName, lastName } = splitName(layby.name);
  const currency = dpoCurrency();
  let created;
  try {
    created = await createToken({
      companyRef,
      amount,
      currency,
      description: `Layby ${layby.id} payment ${companyRef}`,
      customer: { firstName, lastName, email: layby.email, phone: layby.phone ?? undefined, country: "Namibia" },
      siteUrl: requestSiteUrl(req),
    });
  } catch (err) {
    return NextResponse.json({ error: formatDpoNetworkError(err) }, { status: 500 });
  }
  if (created.result !== "000" || !created.transToken) {
    return NextResponse.json({ error: created.explanation?.trim() || "Could not start the payment." }, { status: 400 });
  }

  const payload: DpoPaymentPayload = {
    userId: user.id,
    email: layby.email,
    name: layby.name,
    phone: layby.phone ?? undefined,
    address: "",
    city: "",
    country: "Namibia",
    shippingMethod: "layby",
    shippingCost: 0,
    notes: "",
    lines: [],
    layby: { kind: "instalment", laybyId: layby.id },
  };
  const { error } = await admin.from("payments").insert({
    provider: "dpo",
    company_ref: companyRef,
    trans_token: created.transToken,
    trans_ref: created.transRef,
    product_code: layby.id,
    amount,
    currency,
    status: "pending",
    customer_email: layby.email,
    customer_name: layby.name,
    user_id: user.id,
    payload,
  });
  if (error) return NextResponse.json({ error: "Could not record payment." }, { status: 500 });

  return NextResponse.json({
    paymentUrl: dpoPaymentUrl(created.transToken),
    companyRef,
    transToken: created.transToken,
    amount,
    balanceAfter: money(laybyBalance(layby) - amount),
  });
}
