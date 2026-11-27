import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { CouponView } from "@/components/coupon-view";
import { toClientProduct } from "@/lib/listing-core";
import { getProductByCode } from "@/lib/offline-catalog";
import {
  STAFF_COOKIE,
  couponStatus,
  couponUrl,
  firstNameInitial,
  loadCoupon,
  maskWhatsapp,
  normalizeCouponCode,
  staffFromCookie,
} from "@/lib/opening";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Your opening coupon",
  robots: { index: false, follow: false },
};

const when = (iso: string | null) =>
  iso
    ? new Intl.DateTimeFormat("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Africa/Windhoek",
      }).format(new Date(iso))
    : null;

export default async function CouponPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ new?: string }>;
}) {
  const code = normalizeCouponCode((await params).code);
  const found = await loadCoupon(code).catch(() => null);
  if (!found) notFound();
  const { coupon, lead } = found;
  const staff = staffFromCookie((await cookies()).get(STAFF_COOKIE)?.value);
  const wish = lead.wish_code ? getProductByCode(lead.wish_code) : undefined;
  const qrSvg = await QRCode.toString(couponUrl(code), { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: "#0c110b", light: "#ffffff" } });

  return (
    <CouponView
      code={code}
      status={couponStatus(coupon)}
      name={firstNameInitial(lead.name)}
      qrSvg={qrSvg}
      wish={wish ? toClientProduct(wish) : null}
      isNew={(await searchParams).new === "1"}
      issued={when(coupon.created_at)!}
      redeemedAt={when(coupon.redeemed_at)}
      redeemedBy={coupon.redeemed_by}
      redeemedChannel={coupon.redeemed_channel}
      staff={staff}
      staffDetails={staff ? { whatsapp: maskWhatsapp(lead.whatsapp), email: lead.email } : null}
    />
  );
}
