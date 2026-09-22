"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { OrderStatusBadge } from "@/components/order-status-badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import { useLocale } from "@/components/locale-provider";
import { useAuth } from "@/lib/stores/auth";
import { useOrders } from "@/lib/stores/orders";

function statusKey(status: string) {
  if (status === "shipped") return "statusShipped" as const;
  if (status === "preparing") return "statusPreparing" as const;
  if (status === "cancelled") return "statusCancelled" as const;
  return "statusReserved" as const;
}

export default function OrdersPage() {
  const user = useAuth((s) => s.user);
  const orders = useOrders((s) => s.orders);
  const syncRemote = useOrders((s) => s.syncRemote);
  const { t, format } = useLocale();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await syncRemote();
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [syncRemote]);

  // Show every order saved on this device, plus anything pulled from Supabase.
  // Do not filter by login email — checkout email often differs from the demo account.
  const mine = useMemo(() => orders, [orders]);

  if (!user) {
    return (
      <div className="mx-auto max-w-[640px] px-4 py-16 text-center">
        <h1 className="font-[family-name:var(--font-oswald)] text-4xl uppercase">{t("account.orders")}</h1>
        <p className="mt-3 text-sm text-[var(--muted)]">{t("account.ordersSignIn")}</p>
        <Button asChild className="mt-6">
          <Link href="/login">{t("nav.signIn")}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="page-shell py-8">
      <Breadcrumbs
        items={[
          { href: "/", label: t("common.home") },
          { href: "/account", label: t("account.myAccount") },
          { label: t("account.orders") },
        ]}
      />
      <h1 className="mt-6 font-[family-name:var(--font-oswald)] text-4xl uppercase">
        {t("account.orders")}
      </h1>
      <p className="mt-2 max-w-2xl text-sm text-[var(--muted)]">
        {t("account.ordersIntro")}
      </p>

      {loading && !mine.length ? (
        <div className="mt-10 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-6 py-16 text-center">
          <p className="text-sm text-[var(--muted)]">{t("account.ordersHint")}</p>
        </div>
      ) : !mine.length ? (
        <div className="mt-10 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-6 py-16 text-center">
          <p className="text-lg font-semibold">{t("account.noOrders")}</p>
          <p className="mt-2 text-sm text-[var(--muted)]">{t("account.noOrdersHint")}</p>
        </div>
      ) : (
        <>
        <div className="mt-8 space-y-4 md:hidden">
          {mine.map((order) => {
            return (
              <article key={order.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
                <p className="font-mono text-lg font-bold text-[var(--accent)]">{order.id}</p>
                <p className="mt-1 text-xs text-[var(--muted)]">{formatDate(order.createdAt)}</p>
                <p className="mt-3 text-sm">
                  {order.name}
                  <br />
                  {order.city}, {order.country}
                </p>
                <p className="mt-3 text-lg font-semibold">{format(order.total)}</p>
                <p className="mt-3">
                  <OrderStatusBadge status={order.status} />
                </p>
              </article>
            );
          })}
        </div>
        <div className="mt-8 hidden overflow-hidden rounded-xl border border-[var(--border)] md:block">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="bg-[var(--surface-2)] text-[11px] uppercase tracking-wider text-[var(--muted)]">
              <tr>
                <th className="px-3 py-3">{t("account.date")}</th>
                <th className="px-3 py-3">{t("account.order")}</th>
                <th className="px-3 py-3">{t("account.shipTo")}</th>
                <th className="px-3 py-3">{t("account.total")}</th>
                <th className="px-3 py-3">{t("account.status")}</th>
              </tr>
            </thead>
            <tbody>
              {mine.map((order) => {
                const active = statusKey(order.status);
                const stepKeys = [
                  "statusNext",
                  "statusPreparing",
                  "statusWaiting",
                  "statusReserved",
                  "statusShipped",
                  "statusDelivered",
                ] as const;
                return (
                  <tr key={order.id} className="border-t border-[var(--border)] align-top">
                    <td className="px-3 py-4 whitespace-nowrap">{formatDate(order.createdAt)}</td>
                    <td className="px-3 py-4">
                      <p className="font-mono font-bold text-[var(--accent)]">{order.id}</p>
                      <p className="text-xs text-[var(--muted)]">{t.plural("count.lines", order.items.length)}</p>
                    </td>
                    <td className="px-3 py-4 text-xs leading-5">
                      {order.name}
                      <br />
                      {order.address}
                      <br />
                      {order.city}, {order.country}
                    </td>
                    <td className="px-3 py-4">{format(order.total)}</td>
                    <td className="px-3 py-4">
                      <OrderStatusBadge status={order.status} />
                      <ol className="mt-3 space-y-1">
                        {stepKeys.map((step) => (
                          <li key={step} className="flex items-center gap-2 text-[11px]">
                            <span
                              className={`h-2 w-2 rounded-full ${
                                step === active ? "bg-[var(--accent)]" : "border border-[var(--border-strong)]"
                              }`}
                            />
                            <span className={step === active ? "text-ink" : "text-[var(--muted-2)]"}>
                              {t(`account.${step}`)}
                            </span>
                          </li>
                        ))}
                      </ol>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        </>
      )}
    </div>
  );
}
