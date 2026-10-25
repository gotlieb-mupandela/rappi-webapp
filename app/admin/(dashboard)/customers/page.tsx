import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format";
import { Badge } from "@/components/ui/badge";

export const metadata = { title: "Customers · Admin" };

export default async function AdminCustomersPage() {
  const supabase = await createClient();
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  const emails = (profiles ?? []).map((p) => p.email);
  const { data: orderRows } = emails.length
    ? await supabase.from("orders").select("email, id").in("email", emails)
    : { data: [] as { email: string; id: string }[] };

  const orderCount = new Map<string, number>();
  for (const o of orderRows ?? []) {
    orderCount.set(o.email, (orderCount.get(o.email) ?? 0) + 1);
  }

  return (
    <div>
      <h1 className="font-[family-name:var(--font-oswald)] text-3xl uppercase sm:text-4xl">
        Customers
      </h1>
      <p className="mt-2 text-sm text-[var(--muted)]">
        Read-only profiles. Promote admins via SQL{" "}
        <code className="text-[var(--accent)]">select promote_admin(&apos;email&apos;)</code>.
      </p>

      <div className="mt-8 space-y-3 md:hidden">
        {(profiles ?? []).length === 0 ? (
          <p className="rounded-xl border border-[var(--border)] px-4 py-12 text-center text-[var(--muted)]">
            No profiles yet.
          </p>
        ) : (
          (profiles ?? []).map((p) => (
            <article
              key={p.id}
              className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4"
            >
              <p className="font-semibold">{p.full_name || "—"}</p>
              <p className="break-all text-xs text-[var(--muted)]">{p.email}</p>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <Badge variant={p.role === "admin" ? "new" : "muted"}>{p.role}</Badge>
                <Link href="/admin/orders" className="text-sm hover:text-[var(--accent)]">
                  {orderCount.get(p.email) ?? 0} orders
                </Link>
              </div>
              <p className="mt-2 text-xs text-[var(--muted)]">{formatDate(p.created_at)}</p>
            </article>
          ))
        )}
      </div>

      <div className="mt-8 hidden max-h-[calc(100dvh-12rem)] overflow-auto rounded-xl border border-[var(--border)] md:block">
        <table className="w-full min-w-[700px] text-left text-sm">
          <thead className="sticky top-0 z-10 bg-[var(--surface)] text-[11px] uppercase tracking-wider text-[var(--muted)] shadow-[0_1px_0_var(--border)]">
            <tr>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Orders</th>
              <th className="px-4 py-3">Joined</th>
            </tr>
          </thead>
          <tbody>
            {(profiles ?? []).length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-12 text-center text-[var(--muted)]">
                  No profiles yet.
                </td>
              </tr>
            ) : (
              (profiles ?? []).map((p) => (
                <tr key={p.id} className="border-t border-[var(--border)]">
                  <td className="px-4 py-3">
                    <p className="font-semibold">{p.full_name || "—"}</p>
                    <p className="text-xs text-[var(--muted)]">{p.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={p.role === "admin" ? "new" : "muted"}>
                      {p.role}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/orders`}
                      className="hover:text-[var(--accent)]"
                    >
                      {orderCount.get(p.email) ?? 0}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-[var(--muted)]">
                    {formatDate(p.created_at)}
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
