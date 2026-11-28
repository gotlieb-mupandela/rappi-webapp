import { NextResponse } from "next/server";
import { laybyBalance, money } from "@/lib/layby";
import { cancelLayby, recordLaybyCashPayment, sendLaybyReminder } from "@/lib/layby-server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: isAdmin } = await supabase.rpc("is_admin");
  return isAdmin ? user : null;
}

/**
 * Staff actions on a layby:
 * { action: "payment", amount, method: "cash" | "eft" } records money taken in store,
 * { action: "remind" } emails the customer a reminder now,
 * { action: "cancel", reason } cancels (30% fee, capped at the amount paid) and restocks,
 * { action: "refund_done" } marks the refund as paid out.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  const id = (await params).id.toUpperCase();
  let body: { action?: string; amount?: unknown; method?: string; reason?: string; staff?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const by = String(body.staff ?? "").trim() || user.email || "staff";
  const admin = createAdminClient();
  const { data: layby } = await admin.from("laybys").select("*").eq("id", id).maybeSingle();
  if (!layby) return NextResponse.json({ error: "Layby not found." }, { status: 404 });

  try {
    switch (body.action) {
      case "payment": {
        if (layby.status !== "active") return NextResponse.json({ error: "This layby is not active." }, { status: 400 });
        const amount = money(Number(body.amount));
        const method = body.method === "eft" ? "eft" : "cash";
        if (!Number.isFinite(amount) || amount <= 0 || amount > laybyBalance(layby)) {
          return NextResponse.json({ error: `Enter an amount up to the balance (N$${laybyBalance(layby).toFixed(2)}).` }, { status: 400 });
        }
        const updated = await recordLaybyCashPayment(id, amount, method, by);
        return NextResponse.json({ ok: true, layby: updated });
      }
      case "remind": {
        if (layby.status !== "active") return NextResponse.json({ error: "This layby is not active." }, { status: 400 });
        const r = await sendLaybyReminder(layby, new Date(), true);
        return r.sent
          ? NextResponse.json({ ok: true })
          : NextResponse.json({ error: "A reminder was already sent today." }, { status: 409 });
      }
      case "cancel": {
        const reason = String(body.reason ?? "").trim();
        if (!reason) return NextResponse.json({ error: "Give a reason for cancelling." }, { status: 400 });
        const updated = await cancelLayby(id, reason, by);
        return NextResponse.json({ ok: true, layby: updated });
      }
      case "refund_done": {
        if (layby.status !== "cancelled") return NextResponse.json({ error: "Only cancelled laybys have refunds." }, { status: 400 });
        const { data: updated } = await admin
          .from("laybys")
          .update({ refund_done_at: new Date().toISOString(), refund_done_by: by })
          .eq("id", id)
          .is("refund_done_at", null)
          .select("*")
          .maybeSingle();
        return NextResponse.json({ ok: true, layby: updated ?? layby });
      }
      default:
        return NextResponse.json({ error: "Unknown action." }, { status: 400 });
    }
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Action failed." }, { status: 500 });
  }
}
