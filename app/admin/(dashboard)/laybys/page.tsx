"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Database } from "@/lib/database.types";
import { formatPrice } from "@/lib/format";
import { LaybyStatePill } from "@/components/admin/layby-state";
import { laybyBalance, laybyState } from "@/lib/layby";
import { createClient } from "@/lib/supabase/client";

type Layby = Database["public"]["Tables"]["laybys"]["Row"];

const day = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "2-digit", timeZone: "Africa/Windhoek" }).format(new Date(iso)) : "—";

const FILTERS = [
  ["open", "Open"],
  ["attention", "Needs attention"],
  ["week", "Due within 7 days"],
  ["refund", "Refund to pay"],
  ["paid", "Paid"],
  ["cancelled", "Cancelled"],
  ["all", "All"],
] as const;
type Filter = (typeof FILTERS)[number][0];

export default function AdminLaybysPage() {
  const [rows, setRows] = useState<Layby[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("open");
  const [q, setQ] = useState("");
  const [now, setNow] = useState(0);

  useEffect(() => {
    void createClient()
      .from("laybys")
      .select("*")
      .order("opened_at", { ascending: false })
      .limit(1000)
      .then(({ data }) => {
        setRows(data ?? []);
        setNow(Date.now());
        setLoading(false);
      });
  }, []);

  const active = rows.filter((l) => l.status === "active");
  const held = active.reduce((s, l) => s + Number(l.paid), 0);
  const owed = active.reduce((s, l) => s + laybyBalance(l), 0);
  const attention = active.filter((l) => laybyState(l) !== "active");
  const refunds = rows.filter((l) => l.status === "cancelled" && !l.refund_done_at && Number(l.refund_amount) > 0);

  const shown = (() => {
    const term = q.trim().toLowerCase();
    return rows.filter((l) => {
      if (term && !`${l.id} ${l.order_id} ${l.name} ${l.email} ${l.phone ?? ""}`.toLowerCase().includes(term)) return false;
      switch (filter) {
        case "open":
          return l.status === "active";
        case "attention":
          return l.status === "active" && laybyState(l) !== "active";
        case "week":
          return l.status === "active" && new Date(l.final_due_at).getTime() - now < 7 * 86_400_000;
        case "refund":
          return l.status === "cancelled" && !l.refund_done_at && Number(l.refund_amount) > 0;
        case "paid":
          return l.status === "paid";
        case "cancelled":
          return l.status === "cancelled";
        default:
          return true;
      }
    });
  })();

  const cards = [
    ["Active laybys", String(active.length)],
    ["Money received (active)", formatPrice(held)],
    ["Still to be paid", formatPrice(owed)],
    ["Need attention", String(attention.length)],
    ["Refunds to pay", String(refunds.length)],
  ];

  return (
    <div>
      <h1 className="font-[family-name:var(--font-oswald)] text-3xl uppercase">Laybys</h1>
      <p className="mt-1 max-w-2xl text-sm text-[var(--muted)]">
        20% deposit online, the rest within 3 months (min N$100 per payment). Stock is reserved from the deposit. Don&apos;t pack or send a layby
        until it shows <strong>Paid in full</strong>; it then moves to Orders as a normal order.
      </p>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {cards.map(([label, value]) => (
          <div key={label} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <p className="text-xs uppercase tracking-wider text-[var(--muted)]">{label}</p>
            <p className="mt-1 break-words text-xl font-semibold tabular-nums xl:text-2xl">{value}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        {FILTERS.map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setFilter(id)}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${filter === id ? "border-[var(--accent)] bg-[var(--accent)] text-[#0c110b]" : "border-[var(--border)]"}`}
          >
            {label}
          </button>
        ))}
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name, email, phone, LB-…"
          className="ml-auto h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm sm:w-72"
        />
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-[var(--border)]">
        <table className="w-full min-w-[820px] text-sm">
          <thead className="bg-[var(--surface-2)] text-left text-xs uppercase tracking-wider text-[var(--muted)]">
            <tr>
              <th className="px-3 py-2">Layby</th>
              <th className="px-3 py-2">Customer</th>
              <th className="px-3 py-2 text-right">Total</th>
              <th className="px-3 py-2 text-right">Paid</th>
              <th className="px-3 py-2 text-right">Balance</th>
              <th className="px-3 py-2">Last payment</th>
              <th className="px-3 py-2">Pay by</th>
              <th className="px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-[var(--muted)]">
                  Loading…
                </td>
              </tr>
            ) : shown.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-[var(--muted)]">
                  No laybys here.
                </td>
              </tr>
            ) : (
              shown.map((l) => (
                <tr key={l.id} className="border-t border-[var(--border)] hover:bg-[var(--hover)]">
                  <td className="px-3 py-2.5">
                    <Link href={`/admin/laybys/${l.id}`} className="font-semibold underline-offset-2 hover:underline">
                      {l.id}
                    </Link>
                    <div className="text-xs text-[var(--muted)]">{day(l.opened_at)}</div>
                  </td>
                  <td className="px-3 py-2.5">
                    <div>{l.name}</div>
                    <div className="text-xs text-[var(--muted)]">{l.phone ?? l.email}</div>
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{formatPrice(Number(l.total))}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{formatPrice(Number(l.paid))}</td>
                  <td className="px-3 py-2.5 text-right font-semibold tabular-nums">
                    {l.status === "cancelled" ? `Refund ${formatPrice(Number(l.refund_amount ?? 0))}${l.refund_done_at ? " ✓" : ""}` : formatPrice(laybyBalance(l))}
                  </td>
                  <td className="px-3 py-2.5">{day(l.last_payment_at)}</td>
                  <td className="px-3 py-2.5">{day(l.final_due_at)}</td>
                  <td className="px-3 py-2.5">
                    <LaybyStatePill layby={l} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
