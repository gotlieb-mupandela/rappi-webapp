import Link from "next/link";
import { OrderStatusBadge } from "@/components/order-status-badge";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatPrice } from "@/lib/format";

export const metadata = { title: "Admin" };

export default async function AdminDashboardPage() {
  const supabase = await createClient();

  const [
    { count: skuCount },
    { count: lowStock },
    { data: ordersByStatus },
    { data: recentOrders },
  ] = await Promise.all([
    supabase.from("products").select("*", { count: "exact", head: true }),
    supabase
      .from("products")
      .select("*", { count: "exact", head: true })
      .gt("stock_qty", 0)
      .lt("stock_qty", 5),
    supabase.from("orders").select("status"),
    supabase
      .from("orders")
      .select("id, email, full_name, total, status, created_at")
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  const statusCounts = { reserved: 0, preparing: 0, shipped: 0, cancelled: 0 };
  for (const row of ordersByStatus ?? []) {
    const s = row.status as keyof typeof statusCounts;
    if (s in statusCounts) statusCounts[s] += 1;
  }

  const cards = [
    { label: "SKUs", value: String(skuCount ?? 0), href: "/admin/products" },
    { label: "Low stock", value: String(lowStock ?? 0), href: "/admin/products?low=1" },
    { label: "Reserved", value: String(statusCounts.reserved), href: "/admin/orders?status=reserved" },
    { label: "Preparing", value: String(statusCounts.preparing), href: "/admin/orders?status=preparing" },
  ];

  return (
    <div>
      <h1 className="font-[family-name:var(--font-oswald)] text-3xl uppercase tracking-wide sm:text-4xl">
        Dashboard
      </h1>
      <p className="mt-2 text-sm text-[var(--muted)]">
        Catalog, orders, and content for web + mobile.
      </p>

      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Link
            key={c.label}
            href={c.href}
            className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 transition-colors hover:border-[var(--border-strong)]"
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
              {c.label}
            </p>
            <p className="mt-2 font-[family-name:var(--font-oswald)] text-3xl text-ink">
              {c.value}
            </p>
          </Link>
        ))}
      </div>

      <section className="mt-10">
        <div className="mb-4 flex items-end justify-between">
          <h2 className="font-[family-name:var(--font-oswald)] text-xl uppercase">
            Recent orders
          </h2>
          <Link
            href="/admin/orders"
            className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--accent)]"
          >
            View all
          </Link>
        </div>
        <div className="overflow-hidden rounded-xl border border-[var(--border)]">
          <table className="w-full text-left text-sm">
            <thead className="bg-[var(--hover)] text-[11px] uppercase tracking-wider text-[var(--muted)]">
              <tr>
                <th className="px-4 py-3">Order</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">When</th>
              </tr>
            </thead>
            <tbody>
              {(recentOrders ?? []).length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-[var(--muted)]">
                    No orders yet.
                  </td>
                </tr>
              ) : (
                (recentOrders ?? []).map((o) => (
                  <tr key={o.id} className="border-t border-[var(--border)]">
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/orders/${o.id}`}
                        className="font-mono font-bold text-[var(--accent)] hover:underline"
                      >
                        {o.id}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <p>{o.full_name}</p>
                      <p className="text-xs text-[var(--muted)]">{o.email}</p>
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
      </section>
    </div>
  );
}
