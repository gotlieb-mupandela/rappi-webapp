import { StockSyncForm } from "@/components/admin/stock-sync-form";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format";

export const metadata = { title: "Stock sync · Admin" };

export default async function StockSyncPage() {
  const supabase = await createClient();
  const { data: runs } = await supabase
    .from("stock_sync_runs")
    .select("id, filename, matched, unmatched_codes, created_at")
    .order("created_at", { ascending: false })
    .limit(10);

  return (
    <div>
      <h1 className="font-[family-name:var(--font-oswald)] text-3xl uppercase sm:text-4xl">
        Stock sync
      </h1>
      <p className="mt-2 max-w-2xl text-sm text-[var(--muted)]">
        Upload a Joma B2B export. Matching SKUs update live size stock in Supabase. The website
        and app pick up the change after the catalog cache refreshes.
      </p>
      <div className="mt-8">
        <StockSyncForm />
      </div>
      <section className="mt-10">
        <h2 className="text-sm font-bold uppercase tracking-wider">Recent runs</h2>
        <div className="mt-3 overflow-auto rounded-xl border border-[var(--border)]">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-[var(--surface)] text-[11px] uppercase tracking-wider text-[var(--muted)]">
              <tr>
                <th className="px-4 py-3">When</th>
                <th className="px-4 py-3">File</th>
                <th className="px-4 py-3">Matched</th>
                <th className="px-4 py-3">Unmatched</th>
              </tr>
            </thead>
            <tbody>
              {(runs ?? []).length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-[var(--muted)]">
                    No syncs yet.
                  </td>
                </tr>
              ) : (
                (runs ?? []).map((run) => (
                  <tr key={run.id} className="border-t border-[var(--border)]">
                    <td className="px-4 py-3 text-[var(--muted)]">{formatDate(run.created_at)}</td>
                    <td className="px-4 py-3">{run.filename || "—"}</td>
                    <td className="px-4 py-3">{run.matched}</td>
                    <td className="px-4 py-3">{run.unmatched_codes?.length ?? 0}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
