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
  if (pathname?.startsWith("/checkout")) return null;
  if (!live) return <OpeningStrip hidden={pathname === "/opening" || pathname?.startsWith("/c/")} />;
  if (pathname === BLACK_FRIDAY_PATH) return null;
  return (
    <div className="flex h-9 items-center justify-center gap-2 overflow-hidden whitespace-nowrap bg-[#0c110b] px-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-white sm:gap-3.5 sm:text-[13px]">
      <span className="text-[#5eff38]">Black Friday</span>
      <span className="hidden sm:inline" aria-hidden>
        ·
      </span>
      <span className="hidden sm:inline">200 deals: free gifts &amp; 10% off</span>
      <Link href={BLACK_FRIDAY_PATH} className={`rounded-full px-3 py-1.5 font-extrabold ${LIME}`}>
        Shop the deals →
      </Link>
    </div>
  );
}

const OPENING_PROMO_ENDS_AT = Date.parse("2027-02-01T00:00:00+02:00");
const noSubscribeOpening = () => () => {};

/** After Black Friday, the same strip invites people to the store opening questionnaire. */
function OpeningStrip({ hidden }: { hidden: boolean }) {
  const on = useSyncExternalStore(noSubscribeOpening, () => Date.now() < OPENING_PROMO_ENDS_AT, () => false);
  if (hidden || !on) return null;
  return (
    <div className="flex h-9 items-center justify-center gap-2 overflow-hidden whitespace-nowrap bg-[#0c110b] px-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-white sm:gap-3.5 sm:text-[13px]">
      <span className="text-[#5eff38]">New store · 5 Jan</span>
      <span className="hidden sm:inline">Walvis Bay opening</span>
      <Link href="/opening" className={`rounded-full px-3 py-1.5 font-extrabold ${LIME}`}>
        Get 5% off →
      </Link>
    </div>
  );
}

export function BlackFridayBanner() {
  const live = useLive();
  if (!live) return null;
  // Tiles shown: 4 on phones, tablets and small laptops, 5 from 1280px, 6 from 1536px.
  const tileVisibility = (i: number) => (i === 4 ? "hidden xl:flex" : i === 5 ? "hidden 2xl:flex" : "flex");
  return (
    <Link
      href={BLACK_FRIDAY_PATH}
      className="mb-2 flex flex-none flex-col gap-4 overflow-hidden rounded-2xl bg-[#0c110b] bg-[radial-gradient(600px_300px_at_80%_0%,rgba(94,255,56,.28),transparent_60%)] p-[18px] text-white sm:mb-3 sm:p-6 lg:flex-row lg:items-center lg:gap-6 lg:px-7 lg:py-4 xl:gap-8 xl:px-8"
    >
      <div className="min-w-0 lg:flex-none">
        <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-[#5eff38]">{BLACK_FRIDAY_DATES}</p>
        <h2 className="mt-1 whitespace-nowrap font-[family-name:var(--font-oswald)] text-[40px] font-bold uppercase leading-[0.95] xl:text-[52px]">
          Black <span className="text-[#5eff38]">Friday</span>
        </h2>
        <p className="mt-1.5 whitespace-nowrap text-sm text-white/80">200 deals · free gifts · 10% off</p>
      </div>
      <div className="grid grid-cols-4 gap-2 pb-2 sm:max-w-[26rem] lg:flex lg:max-w-none lg:flex-1 lg:justify-center lg:gap-2.5">
        {BANNER_DEALS.map((d, i) => (
          <div
            key={d.code}
            className={`relative aspect-square items-center justify-center rounded-xl bg-white lg:h-20 lg:w-20 lg:flex-none xl:h-[88px] xl:w-[88px] 2xl:h-24 2xl:w-24 ${tileVisibility(i)}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={dealImage(d.code)}
              alt=""
              width={96}
              height={96}
              fetchPriority="high"
              className="h-[80%] w-[80%] object-contain"
            />
            <span
              className={`absolute -bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-1.5 py-1 text-[9px] font-extrabold uppercase leading-none ${LIME}`}
            >
              {d.tag}
            </span>
          </div>
        ))}
      </div>
      <span
        className={`whitespace-nowrap rounded-full px-6 py-3.5 text-center text-sm font-extrabold uppercase tracking-[0.05em] sm:self-start lg:flex-none lg:self-auto ${LIME}`}
      >
        Shop all 200 deals →
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
