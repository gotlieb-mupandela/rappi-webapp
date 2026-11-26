"use client";

import { blackFridayOffer, type BlackFridayOffer } from "@/lib/black-friday";
import type { CartLine } from "@/lib/types";

export function cartOffer(lines: CartLine[]): BlackFridayOffer {
  return blackFridayOffer(
    lines.map((l) => ({
      code: l.code,
      name: l.name,
      category: l.category,
      subcategory: l.subcategory,
      price: l.price,
      qty: l.qty,
    })),
  );
}

/** Free gift rows, shown under the paid items in the cart and checkout. */
export function BlackFridayGiftRows({ offer, compact = false }: { offer: BlackFridayOffer; compact?: boolean }) {
  if (!offer.gifts.length) return null;
  return (
    <ul className={compact ? "divide-y divide-[var(--border)]" : "space-y-3"}>
      {offer.gifts.map((g) => (
        <li
          key={`${g.code}-${g.name}-${g.forCode ?? "order"}`}
          className={
            compact
              ? "flex items-center gap-3 py-2"
              : "flex items-center gap-3 rounded-xl border-2 border-dashed border-[#5eff38] bg-[#f4ffef] p-3 sm:gap-4 sm:p-4"
          }
        >
          <span
            className={`flex flex-none items-center justify-center rounded-lg border border-[var(--border)] bg-white ${compact ? "h-10 w-10" : "h-16 w-16 sm:h-20 sm:w-20"}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={g.image} alt="" className="max-h-[82%] max-w-[82%] object-contain" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-2">
              <span className="rounded-md bg-[#5eff38] px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-[#0c110b]">
                Free gift
              </span>
              <span className={`font-semibold ${compact ? "text-sm" : "text-base"}`}>
                {g.qty} × {g.name}
              </span>
            </span>
            <span className="mt-0.5 block text-xs text-[var(--muted)]">
              Black Friday · {g.forCode ? `with ${g.forCode}` : g.reason}
            </span>
          </span>
          <span className="flex-none text-right text-sm font-bold uppercase text-[#2f8a12]">Free</span>
        </li>
      ))}
    </ul>
  );
}

/** One row per Black Friday discount, as negative amounts. */
export function BlackFridayDiscountRows({
  offer,
  format,
  className = "flex justify-between gap-3 text-[#2f8a12]",
}: {
  offer: BlackFridayOffer;
  format: (n: number) => string;
  className?: string;
}) {
  return (
    <>
      {offer.discounts.map((d) => (
        <p key={d.label} className={className}>
          <span>Black Friday: {d.label}</span>
          <span className="flex-none">-{format(d.amount)}</span>
        </p>
      ))}
    </>
  );
}
