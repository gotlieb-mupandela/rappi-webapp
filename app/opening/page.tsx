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
    <div className="min-h-screen bg-[#f4f5f2]">
      <section className="bg-[#0c110b] bg-[radial-gradient(700px_360px_at_85%_0%,rgba(94,255,56,.25),transparent_60%)] pb-12 pt-8 text-white sm:pb-16 sm:pt-12">
        <div className="page-shell"><div className="mx-auto max-w-2xl">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#5eff38] sm:text-[13px]">
            New store · Walvis Bay · Opens Tue 5 Jan
          </p>
          <h1 className="mt-2 font-[family-name:var(--font-oswald)] text-[44px] font-bold uppercase leading-[0.92] sm:text-[64px]">
            Get <span className="text-[#5eff38]">{COUPON_RATE}% off</span> at our opening
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed text-white/80 sm:text-[17px]">
            Tell us what you play and what you&apos;d like in our new store. You get a personal {COUPON_RATE}% coupon
            straight away, valid {COUPON_VALID_LABEL}, in store or online.
          </p>
          <ul className="mt-5 flex flex-wrap gap-2 text-[13px] font-semibold text-white/90">
            {["Takes 2 minutes", "Coupon emailed instantly", `Valid ${COUPON_VALID_LABEL}`].map((t) => (
              <li key={t} className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 ring-1 ring-white/15">
                <svg viewBox="0 0 20 20" aria-hidden className="h-4 w-4 text-[#5eff38]">
                  <path d="M5 10.5l3.2 3.2L15 7" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {t}
              </li>
            ))}
          </ul>
        </div></div>
      </section>
      <div className="page-shell -mt-4 pb-10 sm:-mt-6 sm:pb-14">
        <div className="mx-auto max-w-2xl">
          <OpeningForm />
        </div>
      </div>
    </div>
  );
}
