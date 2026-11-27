import type { Metadata } from "next";
import { OpeningForm } from "@/components/opening-form";
import { COUPON_RATE, COUPON_VALID_LABEL, OPENING_DAY_LABEL } from "@/lib/opening-options";

export const metadata: Metadata = {
  title: `Store opening: get ${COUPON_RATE}% off`,
  description: `RAPPI Sports Hub opens in Walvis Bay on ${OPENING_DAY_LABEL}. Answer a few questions and get a personal ${COUPON_RATE}% coupon, valid ${COUPON_VALID_LABEL}.`,
  alternates: { canonical: "/opening" },
};

export default function OpeningPage() {
  return (
    <div className="bg-[#f4f5f2]">
      <section className="bg-[#0c110b] bg-[radial-gradient(700px_360px_at_85%_0%,rgba(94,255,56,.25),transparent_60%)] py-8 text-white sm:py-12">
        <div className="page-shell"><div className="mx-auto max-w-2xl">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#5eff38] sm:text-[13px]">
            New store · Walvis Bay · {OPENING_DAY_LABEL}
          </p>
          <h1 className="mt-2 font-[family-name:var(--font-oswald)] text-[44px] font-bold uppercase leading-[0.92] sm:text-[64px]">
            Get <span className="text-[#5eff38]">{COUPON_RATE}% off</span> at our opening
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed text-white/80 sm:text-[17px]">
            Tell us what you play and what you&apos;d like in our new store. It takes 2 minutes. You get a personal{" "}
            {COUPON_RATE}% coupon straight away, valid {COUPON_VALID_LABEL}, in store or online.
          </p>
        </div></div>
      </section>
      <div className="page-shell py-6 sm:py-10">
        <div className="mx-auto max-w-2xl">
          <OpeningForm />
        </div>
      </div>
    </div>
  );
}
