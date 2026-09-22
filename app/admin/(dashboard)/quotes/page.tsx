import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format";

export const metadata = { title: "Quotes · Admin" };

export default async function AdminQuotesPage() {
  const supabase = await createClient();
  const { data: quotes } = await supabase
    .from("teamwear_quotes")
    .select("id, created_at, name, email, organisation, sport, players, sizes, notes, status")
    .order("created_at", { ascending: false })
    .limit(200);

  return (
    <div>
      <h1 className="font-[family-name:var(--font-oswald)] text-3xl uppercase sm:text-4xl">
        Teamwear quotes
      </h1>
      <p className="mt-2 text-sm text-[var(--muted)]">
        Requests from /teamwear. Reply by email from your inbox.
      </p>

      <div className="mt-8 space-y-3 md:hidden">
        {(quotes ?? []).length === 0 ? (
          <p className="rounded-xl border border-[var(--border)] px-4 py-12 text-center text-[var(--muted)]">
            No quote requests yet.
          </p>
        ) : (
          (quotes ?? []).map((q) => (
            <article
              key={q.id}
              className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4"
            >
              <p className="text-xs text-[var(--muted)]">{formatDate(q.created_at)}</p>
              <p className="mt-2 font-semibold">{q.name}</p>
              <p className="break-all text-xs text-[var(--muted)]">{q.email}</p>
              <p className="mt-2 text-sm">{q.organisation || "—"}</p>
              <p className="text-xs text-[var(--muted)]">
                {[q.sport, q.players ? `${q.players} players` : ""].filter(Boolean).join(" · ") || "—"}
              </p>
              <p className="mt-2 break-words text-sm">{q.notes || q.sizes || "—"}</p>
            </article>
          ))
        )}
      </div>

      <div className="mt-8 hidden max-h-[calc(100dvh-12rem)] overflow-auto rounded-xl border border-[var(--border)] md:block">
        <table className="w-full min-w-[880px] text-left text-sm">
          <thead className="sticky top-0 z-10 bg-[var(--surface)] text-[11px] uppercase tracking-wider text-[var(--muted)] shadow-[0_1px_0_var(--border)]">
            <tr>
              <th className="px-4 py-3">When</th>
              <th className="px-4 py-3">Contact</th>
              <th className="px-4 py-3">Team</th>
              <th className="px-4 py-3">Need</th>
            </tr>
          </thead>
          <tbody>
            {(quotes ?? []).length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-12 text-center text-[var(--muted)]">
                  No quote requests yet.
                </td>
              </tr>
            ) : (
              (quotes ?? []).map((q) => (
                <tr key={q.id} className="border-t border-[var(--border)] align-top">
                  <td className="px-4 py-3 text-[var(--muted)]">{formatDate(q.created_at)}</td>
                  <td className="px-4 py-3">
                    <p className="font-semibold">{q.name}</p>
                    <p className="text-xs text-[var(--muted)]">{q.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p>{q.organisation || "—"}</p>
                    <p className="text-xs text-[var(--muted)]">
                      {[q.sport, q.players ? `${q.players} players` : ""]
                        .filter(Boolean)
                        .join(" · ") || "—"}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-xs text-[var(--muted)]">{q.sizes || "—"}</p>
                    <p className="mt-1 max-w-md">{q.notes || "—"}</p>
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
