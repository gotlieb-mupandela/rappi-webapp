"use client";

import { useT } from "@/components/locale-provider";
import { formatPrice } from "@/lib/format";
import { laybyState } from "@/lib/layby";

const CLASS: Record<string, string> = {
  active: "bg-[rgba(94,255,56,0.18)] text-[#2f7a12]",
  overdue: "bg-[rgba(232,163,23,0.18)] text-[#a86a00]",
  expired: "bg-[rgba(226,59,74,0.16)] text-[var(--danger)]",
  paid: "bg-[var(--ok)] text-white",
  cancelled: "bg-neutral-200 text-neutral-600",
};
const LABEL: Record<string, string> = {
  active: "layby.statusActive",
  overdue: "layby.statusOverdue",
  expired: "layby.statusExpired",
  paid: "layby.statusPaid",
  cancelled: "layby.statusCancelled",
};

export function LaybyStatusPill({
  layby,
}: {
  layby: { status: string; total: number; paid: number; opened_at: string; final_due_at: string; last_payment_at: string | null };
}) {
  const t = useT();
  const s = laybyState(layby);
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${CLASS[s]}`}>
      {t(LABEL[s] ?? s)}
    </span>
  );
}

export function LaybyProgress({ paid, total }: { paid: number; total: number }) {
  const t = useT();
  const pct = Math.max(0, Math.min(100, Math.round((paid / total) * 100)));
  return (
    <span className="block">
      <span className="block h-2.5 w-full overflow-hidden rounded-full bg-neutral-200">
        <span className="block h-full rounded-full bg-[var(--accent)]" style={{ width: `${pct}%` }} />
      </span>
      <span className="mt-1 block text-xs text-neutral-600">
        {pct}% · {t("layby.paidOf", { paid: formatPrice(paid), total: formatPrice(total) })}
      </span>
    </span>
  );
}
