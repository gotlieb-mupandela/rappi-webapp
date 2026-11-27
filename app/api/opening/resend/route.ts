import { NextResponse } from "next/server";
import { loadCoupon, normalizeCouponCode } from "@/lib/opening";
import { sendOpeningEmail } from "@/lib/opening-emails";
import { consumeRateLimit, requestIp } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** "Email my coupon again": always goes to the email the coupon was issued to, at most twice a day. */
export async function POST(req: Request) {
  let body: { code?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const found = await loadCoupon(normalizeCouponCode(body.code)).catch(() => null);
  if (!found) return NextResponse.json({ error: "Coupon not found." }, { status: 404 });

  const ipOk = await consumeRateLimit(`opening-resend-ip:${requestIp(req)}`, 10, 3600).catch(() => false);
  const leadOk = ipOk && (await consumeRateLimit(`opening-resend:${found.lead.id}`, 2, 86400).catch(() => false));
  if (!leadOk) {
    return NextResponse.json(
      { error: "We've already sent it twice today. Check your spam and Promotions folders, or WhatsApp us on 081 814 1646." },
      { status: 429 },
    );
  }

  try {
    // A coupon email that never went out is retried (and recorded); otherwise send a copy.
    const first = await sendOpeningEmail(found.lead.id, "coupon");
    if (first === "already") await sendOpeningEmail(found.lead.id, "coupon", { resend: true });
  } catch (err) {
    console.error("opening coupon resend", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Could not send the email right now. Please try again later." }, { status: 502 });
  }
  const [user, domain] = found.lead.email.split("@");
  return NextResponse.json({ ok: true, to: `${user.slice(0, 2)}•••@${domain}` });
}
