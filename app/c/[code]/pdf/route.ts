import { NextResponse } from "next/server";
import { buildCouponPdf, couponFilename } from "@/lib/coupon-pdf";
import { loadCoupon, normalizeCouponCode } from "@/lib/opening";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  const code = normalizeCouponCode((await params).code);
  const found = await loadCoupon(code).catch(() => null);
  if (!found) return NextResponse.json({ error: "Coupon not found." }, { status: 404 });
  const bytes = await buildCouponPdf(found.coupon, found.lead);
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${couponFilename(code)}"`,
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}
