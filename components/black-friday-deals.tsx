"use client";

import Link from "next/link";
import { useState } from "react";
import { useMoney } from "@/components/locale-provider";
import { dealImage, type BlackFridayDeal, type DealGroup } from "@/lib/black-friday";
import { productPath } from "@/lib/utils";

export type DealCard = BlackFridayDeal & { price: number; inStock: boolean };

const FILTERS: { id: DealGroup | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "shoes", label: "Shoes" },
  { id: "swim", label: "Swimwear" },
  { id: "clothing", label: "Clothing" },
  { id: "kids", label: "Kids" },
  { id: "teams", label: "Teams" },
];

export function BlackFridayDeals({ deals }: { deals: DealCard[] }) {
  const { format } = useMoney();
  const [filter, setFilter] = useState<DealGroup | "all">("all");
  const shown = filter === "all" ? deals : deals.filter((d) => d.group === filter);

  return (
    <>
      <div className="flex gap-2 overflow-x-auto pb-1.5 pt-5" role="group" aria-label="Filter deals">
        {FILTERS.map((f) => {
          const n = f.id === "all" ? deals.length : deals.filter((d) => d.group === f.id).length;
          if (!n) return null;
          const on = filter === f.id;
          return (
            <button
              key={f.id}
              type="button"
              aria-pressed={on}
              onClick={() => setFilter(f.id)}
              className={`whitespace-nowrap rounded-full border px-4 py-2 text-[13px] font-semibold uppercase tracking-[0.05em] ${
                on ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-300 text-neutral-900"
              }`}
            >
              {f.label} {f.id === "all" ? n : ""}
            </button>
          );
        })}
      </div>
      <ul className="grid grid-cols-2 gap-2.5 py-3.5 sm:gap-4 lg:grid-cols-4">
        {shown.map((d) => (
          <li key={d.code}>
            <Link
              href={productPath(d.code)}
              className="flex h-full flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white text-neutral-900 transition hover:border-neutral-400"
            >
              <span className="relative flex aspect-square items-center justify-center bg-[#f2f2f2]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={dealImage(d.code)}
                  alt={d.title}
                  loading="lazy"
                  className="max-h-[78%] max-w-[78%] object-contain mix-blend-multiply"
                />
                <span className="absolute left-2 top-2 rounded-lg bg-[#5eff38] px-2 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.06em] text-[#0c110b] sm:left-3 sm:top-3 sm:text-xs">
                  {d.label}
                </span>
                {d.gift ? (
                  <span className="absolute bottom-2 right-2 flex h-11 w-11 items-center justify-center rounded-[10px] border-2 border-[#5eff38] bg-white sm:bottom-2.5 sm:right-2.5 sm:h-16 sm:w-16 sm:rounded-[14px] sm:border-[3px]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={dealImage(d.gift)} alt="Free gift" loading="lazy" className="max-h-[78%] max-w-[78%] object-contain" />
                  </span>
                ) : null}
              </span>
              <span className="flex flex-1 flex-col gap-1 p-2.5 sm:p-4">
                <span className="font-[family-name:var(--font-oswald)] text-base font-semibold uppercase leading-tight sm:text-xl">{d.title}</span>
                <span className="text-[12.5px] leading-snug text-[#3a7a1e] sm:text-sm">{d.offer}</span>
                <span className="mt-auto flex items-center justify-between pt-2.5 text-[15px] font-bold sm:text-[17px]">
                  {d.inStock ? format(d.price) : <span className="text-neutral-500">Sold out</span>}
                  <span className="hidden border-b-2 border-[#5eff38] text-xs font-bold uppercase tracking-[0.06em] sm:inline">
                    Shop deal
                  </span>
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
