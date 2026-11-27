import type { Metadata } from "next";
import { BlackFridayDeals, type DealCard } from "@/components/black-friday-deals";
import { BLACK_FRIDAY_DATES, isBlackFridayLive, type BlackFridayDeal } from "@/lib/black-friday";
import ALL_DEALS from "@/lib/black-friday-deals.json";
import { toClientProduct } from "@/lib/listing-core";
import { getCatalog } from "@/lib/supabase/catalog";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Black Friday deals",
  description:
    "100 Black Friday deals at RAPPI Sports Hub: free gifts on shoes, boots, rackets, gloves, jackets and tracksuits, 10% off swimwear and everyday kit, 3 tank tops for N$400.",
  alternates: { canonical: "/black-friday" },
};

export default async function BlackFridayPage() {
  const catalog = await getCatalog();
  const byCode = new Map(catalog.map((p) => [p.code, p]));
  const deals: DealCard[] = (ALL_DEALS as (BlackFridayDeal & { cutout?: boolean })[]).flatMap((d) => {
    const p = byCode.get(d.code);
    if (!p || p.available === false) return [];
    return [
      {
        ...d,
        price: p.price,
        inStock: (p.stockQty ?? p.totalQty ?? 0) > 0,
        product: d.cutout ? undefined : toClientProduct(p),
      },
    ];
  });
  const live = isBlackFridayLive();

  return (
    <div className="bg-white">
      <section className="bg-[#0c110b] bg-[radial-gradient(800px_400px_at_85%_0%,rgba(94,255,56,.25),transparent_60%)] py-7 text-white sm:py-11">
        <div className="page-shell">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#5eff38] sm:text-[13px]">
            {live ? `${BLACK_FRIDAY_DATES} · while stocks last` : "These deals have ended"}
          </p>
          <h1 className="mt-2.5 font-[family-name:var(--font-oswald)] text-[50px] font-bold uppercase leading-[0.9] sm:text-[84px]">
            Black Friday <span className="text-[#5eff38]">deals</span>
          </h1>
          <p className="mt-3 max-w-[680px] text-[15px] leading-relaxed text-white/80 sm:text-[17px]">
            100 deals across shoes, boots, padel, swimwear, equipment and everyday kit. Free gifts on shoes,
            boots, rackets, gloves, jackets and tracksuits, 10% off when you buy 2.
          </p>
          <ol className="mt-5 flex flex-col gap-2 text-sm text-white/85 sm:flex-row sm:flex-wrap sm:gap-3">
            {[
              "Pick a deal",
              "Add it to your bag",
              "Free gifts are added to your order automatically",
              "Discount deals are confirmed by our team after you order",
            ].map((s, i) => (
              <li key={s} className="rounded-xl border border-white/20 px-3.5 py-2.5">
                <b className="mr-1.5 text-[#5eff38]">{i + 1}</b>
                {s}
              </li>
            ))}
          </ol>
        </div>
      </section>
      <div className="page-shell">
        <BlackFridayDeals deals={deals} />
        <p className="pb-10 text-[13px] leading-relaxed text-neutral-500">
          Valid until 15 December 2026 or while stocks last. Gifts apply across the whole range, not only the
          items shown: one gift per pair or per order as stated. Questions about sizes or stock? WhatsApp 081 814
          1646.
        </p>
      </div>
    </div>
  );
}
