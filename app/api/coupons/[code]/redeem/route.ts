import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  STAFF_COOKIE,
  couponStatus,
  loadCoupon,
  normalizeCouponCode,
  redeemCoupon,
  staffCookieMaxAge,
  staffCookieValue,
  staffFromCookie,
  tillPinMatches,
} from "@/lib/opening";
import { consumeRateLimit, requestIp } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Store till. `{ action: "login", pin, staff }` checks the till PIN and sets a
 * 12-hour cookie; `{ action: "redeem" }` marks the coupon used (cookie needed).
 */
export async function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const code = normalizeCouponCode((await params).code);
  let body: { action?: string; pin?: string; staff?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const jar = await cookies();

  if (body.action === "login") {
    const allowed = await consumeRateLimit(`till-pin:${requestIp(req)}`, 5, 900).catch(() => false);
    if (!allowed) return NextResponse.json({ error: "Too many tries. Wait 15 minutes." }, { status: 429 });
    const staff = String(body.staff ?? "").trim();
    if (!staff) return NextResponse.json({ error: "Enter your name." }, { status: 400 });
    if (!tillPinMatches(String(body.pin ?? ""))) return NextResponse.json({ error: "Wrong PIN." }, { status: 401 });
    jar.set(STAFF_COOKIE, staffCookieValue(staff), {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
      path: "/",
      maxAge: staffCookieMaxAge,
    });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "redeem") {
    const staff = staffFromCookie(jar.get(STAFF_COOKIE)?.value);
    if (!staff) return NextResponse.json({ error: "Enter the till PIN first." }, { status: 401 });
    const found = await loadCoupon(code);
    if (!found) return NextResponse.json({ error: "Coupon not found." }, { status: 404 });
    const status = couponStatus(found.coupon);
    if (status !== "valid") return NextResponse.json({ error: "Coupon is not valid.", status }, { status: 409 });
    const ok = await redeemCoupon(code, staff, "store");
    if (!ok) return NextResponse.json({ error: "Coupon was just used.", status: "used" }, { status: 409 });
    return NextResponse.json({ ok: true, status: "used" });
  }

  return NextResponse.json({ error: "Invalid request." }, { status: 400 });
}
