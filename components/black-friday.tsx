"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import {
  BANNER_DEALS,
  BLACK_FRIDAY_DATES,
  BLACK_FRIDAY_PATH,
  dealImage,
  isBlackFridayLive,
  productDeal,
} from "@/lib/black-friday";
import type { Product } from "@/lib/types";

/** Pages are cached for days, so the end date is checked in the browser too. */
const noSubscribe = () => () => {};
function useLive() {
  return useSyncExternalStore(noSubscribe, () => isBlackFridayLive(), () => true);
}

const LIME = "bg-[#5eff38] text-[#0c110b]";

export function BlackFridayStrip() {
  const pathname = usePathname();
  const live = useLive();
  if (!live || pathname === BLACK_FRIDAY_PATH || pathname?.startsWith("/checkout")) return null;
  return (
    <div className="flex h-9 items-center justify-center gap-2 overflow-hidden whitespace-nowrap bg-[#0c110b] px-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-white sm:gap-3.5 sm:text-[13px]">
      <span className="text-[#5eff38]">Black Friday</span>
      <span className="hidden sm:inline" aria-hidden>
        ·
      </span>
      <span className="hidden sm:inline">Free gifts &amp; 10% off on 20 summer deals</span>
      <Link href={BLACK_FRIDAY_PATH} className={`rounded-full px-3 py-1.5 font-extrabold ${LIME}`}>
        Shop the deals →
      </Link>
    </div>
  );
}

export function BlackFridayBanner() {
  const live = useLive();
  if (!live) return null;
  return (
    <Link
      href={BLACK_FRIDAY_PATH}
      className="relative mb-2 flex flex-none flex-col gap-3.5 overflow-hidden rounded-2xl bg-[#0c110b] bg-[radial-gradient(600px_300px_at_80%_0%,rgba(94,255,56,.28),transparent_60%)] p-[18px] text-white sm:mb-3 lg:flex-row lg:items-center lg:gap-7 lg:px-8 lg:py-5"
    >
      <span className="absolute right-5 top-3.5 hidden text-[11px] font-bold uppercase tracking-[0.15em] text-[#5eff38] lg:block">
        {BLACK_FRIDAY_DATES}
      </span>
      <div className="lg:flex-none">
        <h2 className="font-[family-name:var(--font-oswald)] text-[40px] font-bold uppercase leading-[0.9] lg:text-[56px]">
          Black <span className="text-[#5eff38]">Friday</span>
        </h2>
        <p className="mt-2 text-sm text-white/80 lg:max-w-[22rem] lg:text-base">
          20 summer deals · free gifts · 10% off · 3 tanks for N$400
        </p>
      </div>
      <div className="flex flex-1 justify-between gap-1.5 lg:justify-center lg:gap-2.5">
        {BANNER_DEALS.map((d, i) => (
          <div
            key={d.code}
            className={`relative flex h-[72px] w-[72px] items-center justify-center rounded-[10px] bg-white lg:h-[100px] lg:w-[100px] lg:rounded-[14px] ${i > 3 ? "hidden lg:flex" : ""}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={dealImage(d.code)} alt="" className="max-h-[84%] max-w-[84%] object-contain" />
            <span className={`absolute -bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-1.5 py-1 text-[9px] font-extrabold uppercase leading-none lg:text-[10px] ${LIME}`}>
              {d.tag}
            </span>
          </div>
        ))}
      </div>
      <span className={`rounded-full px-6 py-3.5 text-center text-sm font-extrabold uppercase tracking-[0.05em] lg:flex-none lg:py-4 ${LIME}`}>
        Shop the 20 deals →
      </span>
    </Link>
  );
}

export function BlackFridayProductDeal({ product }: { product: Product }) {
  const live = useLive();
  if (!live || product.sellAs) return null;
  const deal = productDeal(product);
  if (!deal) return null;
  return (
    <Link
      href={BLACK_FRIDAY_PATH}
      className="mt-4 flex items-center gap-4 rounded-2xl bg-[#0c110b] p-3.5 text-white sm:px-4"
    >
      {deal.gift ? (
        <span className="flex h-16 w-16 flex-none items-center justify-center rounded-xl border-[3px] border-[#5eff38] bg-white">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={dealImage(deal.gift)} alt="" className="max-h-[80%] max-w-[80%] object-contain" />
        </span>
      ) : null}
      <span className="min-w-0">
        <span className="block text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#5eff38]">
          Black Friday deal
        </span>
        <span className="mt-1 block font-[family-name:var(--font-oswald)] text-xl font-semibold uppercase leading-tight">{deal.title}</span>
        <span className="mt-0.5 block text-[13px] leading-snug text-white/75">
          {deal.detail} · until 15 Dec · see all deals →
        </span>
      </span>
    </Link>
  );
}
