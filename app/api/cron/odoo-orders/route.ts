import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createOdooClient, odooConfigFromEnv, OdooConfigError } from "@/lib/odoo";
import { syncOrdersToOdoo } from "@/lib/odoo-orders";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Copies new paid website orders and customers into Odoo.
 *
 * Called by Vercel Cron (see vercel.json) and, optionally, by a Supabase
 * Database Webhook on new rows in `orders` for near-instant sync. Both send
 * `Authorization: Bearer <CRON_SECRET>`.
 *
 * Off unless ODOO_ORDERS_SYNC=on. Safe to call repeatedly: orders already in
 * Odoo are skipped. Never deletes and never sends email from Odoo.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = req.headers.get("authorization") ?? "";
  const a = createHash("sha256").update(given).digest();
  const b = createHash("sha256").update(`Bearer ${secret}`).digest();
  return timingSafeEqual(a, b);
}

async function run(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }
  if (process.env.ODOO_ORDERS_SYNC !== "on") {
    return NextResponse.json({ ok: true, skipped: "ODOO_ORDERS_SYNC is not on" });
  }

  let odoo;
  try {
    odoo = createOdooClient(odooConfigFromEnv(), { timeoutMs: 20_000, retries: 2 });
  } catch (error) {
    const message = error instanceof OdooConfigError ? error.message : "Odoo is not configured.";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  try {
    const result = await syncOrdersToOdoo(createAdminClient(), odoo, {
      apply: true,
      confirm: process.env.ODOO_ORDERS_CONFIRM !== "off",
      limit: 25,
      // Recent orders only: older ones are copied with `npm run odoo:orders`.
      since: new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString(),
      timeBudgetMs: 45_000,
    });
    // Order ids and counts only: no customer details in the response or logs.
    const summary = {
      ok: result.errors.length === 0,
      created: result.created.map((c) => c.order),
      alreadyInOdoo: result.alreadyInOdoo,
      contactsCreated: result.contactsCreated,
      needsReview: result.needsReview.map((r) => r.order),
      errors: result.errors.length,
      stoppedEarly: result.stoppedEarly,
    };
    if (result.errors.length || result.needsReview.length) {
      console.warn("odoo-orders sync", JSON.stringify(summary));
    }
    return NextResponse.json(summary, { status: result.errors.length ? 502 : 200 });
  } catch (error) {
    console.error("odoo-orders sync failed", error instanceof Error ? error.message : "unknown error");
    return NextResponse.json({ error: "Sync failed." }, { status: 500 });
  }
}

export const GET = run;
export const POST = run;
