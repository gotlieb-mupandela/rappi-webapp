import Link from "next/link";
import { OrderStatusBadge } from "@/components/order-status-badge";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatPrice } from "@/lib/format";
import { ORDER_STATUSES, orderStatusClass } from "@/lib/order-status";

export const metadata = { title: "Orders · Admin" };

const STATUSES = ORDER_STATUSES;

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();
  let query = supabase
    .from("orders")
    .select("id, email, full_name, total, status, created_at, city, country")
    .order("created_at", { ascending: false })
    .limit(100);

  if (sp.status && STATUSES.includes(sp.status as (typeof STATUSES)[number])) {
    query = query.eq("status", sp.status as (typeof STATUSES)[number]);
  }

  const { data: orders } = await query;

  return (
    <div>
      <h1 className="font-[family-name:var(--font-oswald)] text-3xl uppercase sm:text-4xl">
        Orders
      </h1>
      <p className="mt-2 text-sm text-[var(--muted)]">
        Update fulfillment status for web and mobile checkouts.
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        <Link
          href="/admin/orders"
          className={`rounded-full border px-3 py-1.5 text-[11px] uppercase tracking-wider ${
            !sp.status
              ? "border-[var(--accent)] text-[var(--accent)]"
              : "border-[var(--border)] text-[var(--muted)]"
          }`}
        >
          All
        </Link>
        {STATUSES.map((s) => (
          <Link
            key={s}
            href={`/admin/orders?status=${s}`}
            className={`rounded-full border px-3 py-1.5 text-[11px] uppercase tracking-wider ${
              sp.status === s
                ? `border-current ${orderStatusClass(s)}`
                : "border-[var(--border)] text-[var(--muted)]"
            }`}
          >
            {s}
          </Link>
        ))}
      </div>

      <div className="mt-6 max-h-[calc(100dvh-14rem)] overflow-auto rounded-xl border border-[var(--border)]">
        <table className="w-full min-w-[800px] text-left text-sm">
          <thead className="sticky top-0 z-10 bg-[var(--surface)] text-[11px] uppercase tracking-wider text-[var(--muted)] shadow-[0_1px_0_var(--border)]">
            <tr>
              <th className="px-4 py-3">Order</th>
              <th className="px-4 py-3">Ship to</th>
              <th className="px-4 py-3">Total</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Date</th>
            </tr>
          </thead>
          <tbody>
            {(orders ?? []).length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-[var(--muted)]">
                  No orders in this queue.
                </td>
              </tr>
            ) : (
              (orders ?? []).map((o) => (
                <tr key={o.id} className="border-t border-[var(--border)]">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/orders/${o.id}`}
                      className="font-mono font-bold text-[var(--accent)] hover:underline"
                    >
                      {o.id}
                    </Link>
                    <p className="text-xs text-[var(--muted)]">{o.email}</p>
                  </td>
                  <td className="px-4 py-3 text-xs leading-5">
                    {o.full_name}
                    <br />
                    {o.city}, {o.country}
                  </td>
                  <td className="px-4 py-3">{formatPrice(Number(o.total))}</td>
                  <td className="px-4 py-3">
                    <OrderStatusBadge status={o.status} />
                  </td>
                  <td className="px-4 py-3 text-[var(--muted)]">
                    {formatDate(o.created_at)}
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
