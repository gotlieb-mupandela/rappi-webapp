"use client";

import type { Database } from "@/lib/database.types";
import { laybyState, type LaybyState } from "@/lib/layby";

type Layby = Database["public"]["Tables"]["laybys"]["Row"];

const STATE_CLASS: Record<LaybyState, string> = {
  active: "bg-[rgba(94,255,56,0.18)] text-[#2f7a12]",
  overdue: "bg-[rgba(232,163,23,0.18)] text-[#a86a00]",
  expired: "bg-[rgba(226,59,74,0.16)] text-[var(--danger)]",
  paid: "bg-[var(--ok)] text-white",
  cancelled: "bg-neutral-200 text-neutral-600",
};
const STATE_LABEL: Record<LaybyState, string> = {
  active: "Active",
  overdue: "Behind on payments",
  expired: "Past final date",
  paid: "Paid in full",
  cancelled: "Cancelled",
};

export function LaybyStatePill({ layby }: { layby: Layby }) {
  const s = laybyState(layby);
  return <span className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATE_CLASS[s]}`}>{STATE_LABEL[s]}</span>;
}

