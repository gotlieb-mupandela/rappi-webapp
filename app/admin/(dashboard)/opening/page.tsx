"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { BUYS_FOR, DRAWS, SPEND, SPORTS, TOWNS, WANTS } from "@/lib/opening-options";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/database.types";

type Lead = Database["public"]["Tables"]["opening_leads"]["Row"] & {
  opening_coupons: Pick<Database["public"]["Tables"]["opening_coupons"]["Row"], "code" | "redeemed_at" | "redeemed_by" | "redeemed_channel"> | null;
};

const day = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "Africa/Windhoek" }).format(new Date(iso)) : "";

function Bars({ title, options, counts, total }: { title: string; options: readonly string[]; counts: Map<string, number>; total: number }) {
  return (
    <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">{title}</h2>
      <ul className="mt-3 space-y-1.5 text-sm">
        {[...options]
          .sort((a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0))
          .map((o) => {
            const n = counts.get(o) ?? 0;
            const pct = total ? Math.round((n / total) * 100) : 0;
            return (
              <li key={o}>
                <div className="flex justify-between gap-2">
                  <span>{o}</span>
                  <span className="tabular-nums text-[var(--muted)]">
                    {n} · {pct}%
                  </span>
                </div>
                <div className="mt-0.5 h-1.5 rounded-full bg-neutral-200">
                  <div className="h-1.5 rounded-full bg-[#58b82c]" style={{ width: `${pct}%` }} />
                </div>
              </li>
            );
          })}
      </ul>
    </section>
  );
}

const count = (rows: Lead[], pickValues: (l: Lead) => (string | null)[]) => {
  const m = new Map<string, number>();
  for (const l of rows) for (const v of pickValues(l)) if (v) m.set(v, (m.get(v) ?? 0) + 1);
  return m;
};

const csvCell = (v: unknown) => {
  const s = Array.isArray(v) ? v.join("; ") : String(v ?? "");
  // Stop spreadsheet formulas in customer-typed text.
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

export default function AdminOpeningPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [onlyOrgs, setOnlyOrgs] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("opening_leads")
      .select("*, opening_coupons(code, redeemed_at, redeemed_by, redeemed_channel)")
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) toast.error(error.message);
        setLeads((data ?? []) as unknown as Lead[]);
        setLoading(false);
      });
  }, []);

  const total = leads.length;
  const used = leads.filter((l) => l.opening_coupons?.redeemed_at);
  const orgs = leads.filter((l) => l.org_name);
  const shown = onlyOrgs ? orgs : leads;
  const stats = useMemo(
    () => ({
      towns: count(leads, (l) => [l.town]),
      sports: count(leads, (l) => l.sports),
      buys: count(leads, (l) => l.buys_for),
      wants: count(leads, (l) => l.wants),
      spend: count(leads, (l) => [l.spend]),
      draws: count(leads, (l) => l.draws),
      wish: [...count(leads, (l) => [l.wish_code])].sort((a, b) => b[1] - a[1]).slice(0, 10),
    }),
    [leads],
  );

  function exportCsv() {
    const head = ["signed_up", "name", "email", "whatsapp", "town", "sports", "buys_for", "wants", "spend", "wished_product", "would_bring_them", "school_or_club", "role", "size", "notes", "coupon", "used_on", "used_by", "channel", "unsubscribed"];
    const rows = shown.map((l) => [
      l.created_at, l.name, l.email, l.whatsapp, l.town, l.sports, l.buys_for, l.wants, l.spend, l.wish_code, l.draws,
      l.org_name, l.org_role, l.org_size, l.notes, l.opening_coupons?.code, l.opening_coupons?.redeemed_at,
      l.opening_coupons?.redeemed_by, l.opening_coupons?.redeemed_channel, l.unsubscribed_at,
    ]);
    const csv = [head, ...rows].map((r) => r.map(csvCell).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `opening-leads${onlyOrgs ? "-schools-clubs" : ""}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-[family-name:var(--font-oswald)] text-3xl font-bold uppercase">Opening leads</h1>
          <p className="text-sm text-[var(--muted)]">Questionnaire sign-ups and their 5% opening coupons (valid 5–31 January 2027).</p>
        </div>
        <button type="button" onClick={exportCsv} disabled={!shown.length} className="h-11 rounded-full bg-neutral-900 px-5 text-sm font-bold text-white disabled:opacity-40">
          Download spreadsheet
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Leads", total],
          ["Schools & clubs", orgs.length],
          ["Coupons used in store", used.filter((l) => l.opening_coupons?.redeemed_channel === "store").length],
          ["Coupons used online", used.filter((l) => l.opening_coupons?.redeemed_channel === "online").length],
        ].map(([k, v]) => (
          <div key={k as string} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">{k}</p>
            <p className="mt-1 text-3xl font-semibold tabular-nums">{loading ? "…" : v}</p>
          </div>
        ))}
      </div>

      {total ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <Bars title="Want in the store" options={WANTS} counts={stats.wants} total={total} />
          <Bars title="Sports played" options={SPORTS} counts={stats.sports} total={total} />
          <Bars title="Buy for" options={BUYS_FOR} counts={stats.buys} total={total} />
          <Bars title="Would bring them in January" options={DRAWS} counts={stats.draws} total={total} />
          <Bars title="Spend per visit" options={SPEND} counts={stats.spend} total={total} />
          <Bars title="Where they live" options={TOWNS} counts={stats.towns} total={total} />
          <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Most wished products</h2>
            <ol className="mt-3 space-y-1 text-sm">
              {stats.wish.length ? stats.wish.map(([code, n]) => (
                <li key={code} className="flex justify-between"><span className="font-mono">{code}</span><span className="text-[var(--muted)]">{n}</span></li>
              )) : <li className="text-[var(--muted)]">None picked yet</li>}
            </ol>
          </section>
        </div>
      ) : null}

      <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] p-4">
          <h2 className="text-sm font-bold uppercase tracking-wider">{onlyOrgs ? "Schools & clubs (for Olivia)" : "All leads"}</h2>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={onlyOrgs} onChange={(e) => setOnlyOrgs(e.target.checked)} className="h-4 w-4" />
            Only schools and clubs
          </label>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wider text-[var(--muted)]">
              <tr>
                {["Signed up", "Name", "Contact", "Town", "School / club", "Coupon"].map((h) => <th key={h} className="px-4 py-2 font-semibold">{h}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {loading ? (
                <tr><td className="px-4 py-6 text-[var(--muted)]" colSpan={6}>Loading…</td></tr>
              ) : shown.length ? shown.map((l) => (
                <tr key={l.id} className="align-top">
                  <td className="px-4 py-3 whitespace-nowrap">{day(l.created_at)}</td>
                  <td className="px-4 py-3">{l.name}{l.unsubscribed_at ? <span className="ml-1 text-xs text-red-700">(unsubscribed)</span> : null}</td>
                  <td className="px-4 py-3">
                    <a className="underline" href={`mailto:${l.email}`}>{l.email}</a>
                    <br />
                    <a className="underline" href={`https://wa.me/${l.whatsapp}`} target="_blank" rel="noreferrer">+{l.whatsapp}</a>
                  </td>
                  <td className="px-4 py-3">{l.town}</td>
                  <td className="px-4 py-3">{l.org_name ? <>{l.org_name}<br /><span className="text-[var(--muted)]">{[l.org_role, l.org_size && `${l.org_size} players`].filter(Boolean).join(" · ")}</span></> : "–"}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <a className="font-mono underline" href={`/c/${l.opening_coupons?.code}`} target="_blank" rel="noreferrer">{l.opening_coupons?.code}</a>
                    <br />
                    <span className="text-[var(--muted)]">
                      {l.opening_coupons?.redeemed_at ? `Used ${day(l.opening_coupons.redeemed_at)} (${l.opening_coupons.redeemed_channel})` : "Not used"}
                    </span>
                  </td>
                </tr>
              )) : (
                <tr><td className="px-4 py-6 text-[var(--muted)]" colSpan={6}>No sign-ups yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
