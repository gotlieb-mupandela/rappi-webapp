import { NextResponse } from "next/server";
import { parseAnswers, saveLead } from "@/lib/opening";
import { sendOpeningEmail } from "@/lib/opening-emails";
import { consumeRateLimit, requestIp } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  // Bots fill every field; people never see this one.
  if (body && typeof body === "object" && String((body as Record<string, unknown>).company ?? "").trim()) {
    return NextResponse.json({ ok: true, existing: true });
  }

  try {
    if (!(await consumeRateLimit(`opening:${requestIp(req)}`, 6, 3600))) {
      return NextResponse.json({ error: "Too many sign-ups from this connection. Try again later." }, { status: 429 });
    }
  } catch (err) {
    console.error("opening rate limit", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Please try again in a minute." }, { status: 503 });
  }

  const parsed = parseAnswers(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  try {
    const { code, created } = await saveLead(parsed.value);
    if (created) {
      const admin = createAdminClient();
      const { data: coupon } = await admin.from("opening_coupons").select("lead_id").eq("code", code).single();
      try {
        if (coupon) await sendOpeningEmail(coupon.lead_id, "coupon");
      } catch (err) {
        console.error("opening coupon email", err instanceof Error ? err.message : err);
      }
      return NextResponse.json({ ok: true, code });
    }
    // Already signed up: never show the code here (someone could type another person's email);
    // send it again to the address on file instead, at most twice a day.
    const admin = createAdminClient();
    const { data: coupon } = await admin.from("opening_coupons").select("lead_id").eq("code", code).single();
    if (coupon && (await consumeRateLimit(`opening-resend:${coupon.lead_id}`, 2, 86400))) {
      try {
        await sendOpeningEmail(coupon.lead_id, "coupon", { resend: true });
      } catch (err) {
        console.error("opening coupon resend", err instanceof Error ? err.message : err);
      }
    }
    return NextResponse.json({ ok: true, existing: true });
  } catch (err) {
    console.error("opening signup", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Could not save your answers. Please try again." }, { status: 500 });
  }
}
