"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AccountFrame } from "@/components/account-frame";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/components/locale-provider";
import { formatDate } from "@/lib/format";
import { orderStatusClass } from "@/lib/order-status";
import { useAuth } from "@/lib/stores/auth";
import { useOrders } from "@/lib/stores/orders";
import type { Order } from "@/lib/types";
import { cn } from "@/lib/utils";

const FULFILLMENT = ["reserved", "preparing", "shipped"] as const;

type FulfillmentStatus = (typeof FULFILLMENT)[number];

const STATUS_LABEL = {
  reserved: "account.statusReserved",
  preparing: "account.statusPreparing",
  shipped: "account.statusShipped",
  cancelled: "account.statusCancelled",
} as const;

const CURRENT_MARK = {
  reserved: "bg-[var(--warn)]",
  preparing: "bg-[#3db8ff]",
  shipped: "bg-[var(--ok)]",
} as const;

function isFulfillmentStatus(status: Order["status"]): status is FulfillmentStatus {
  return (FULFILLMENT as readonly string[]).includes(status);
}

function StatusPill({ status }: { status: Order["status"] }) {
  const { t } = useLocale();
  const key = STATUS_LABEL[status];
  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider ${orderStatusClass(status)}`}
    >
      {key ? t(key) : status}
    </span>
  );
}

function FulfillmentTrack({ status }: { status: FulfillmentStatus }) {
  const { t } = useLocale();
  return (
    <ol aria-label={t("account.status")} className="grid w-full grid-cols-3 gap-2">
      {FULFILLMENT.map((step, index) => {
        const current = step === status;
        return (
          <li key={step} aria-current={current ? "step" : undefined} className="min-w-0">
            <span
              aria-hidden
              className={cn(
                "block h-0.5 rounded-full",
                current ? CURRENT_MARK[status] : "bg-[var(--border)]",
              )}
            />
            <span
              className={cn(
                "mt-1.5 block break-words text-[11px] leading-4",
                index === 1 && "text-center",
                index === 2 && "text-right",
                current ? "font-semibold text-black" : "text-neutral-500",
              )}
            >
              {t(STATUS_LABEL[step])}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function OrderRow({ order }: { order: Order }) {
  const { t, format } = useLocale();

  return (
    <li className="min-w-0 px-4 py-4 sm:px-6 sm:py-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <div className="flex min-w-0 items-start justify-between gap-3 sm:block">
          <div className="min-w-0">
            <p className="break-words font-mono text-sm font-semibold text-black">{order.id}</p>
            <p className="mt-1 text-sm leading-5 text-neutral-500">
              <time dateTime={order.createdAt}>{formatDate(order.createdAt)}</time>
              <span className="px-1.5 text-neutral-300" aria-hidden>
                ·
              </span>
              {t.plural("count.lines", order.items.length)}
            </p>
            {order.discountAmount != null && order.discountAmount > 0 ? (
              <p className="mt-1 text-xs leading-4 text-neutral-500">
                {t("account.discountNote", {
                  code: order.discountCode || t("checkout.discountCode"),
                  rate: String(order.discountRate ?? 0),
                })}
              </p>
            ) : null}
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1.5 sm:hidden">
            <p className="text-sm font-semibold tabular-nums text-black">{format(order.total)}</p>
            <StatusPill status={order.status} />
          </div>
        </div>
        <div className="flex max-w-full flex-wrap items-center justify-end gap-x-4 gap-y-1 sm:shrink-0">
          <p className="hidden text-sm font-semibold tabular-nums text-black sm:block">
            {format(order.total)}
          </p>
          <span className="hidden sm:contents">
            <StatusPill status={order.status} />
          </span>
          {order.remote ? (
            <a
              href={`/api/orders/${encodeURIComponent(order.id)}/invoice`}
              className="inline-flex min-h-11 items-center text-sm font-semibold text-black underline decoration-black/20 underline-offset-4 transition-colors hover:text-[var(--accent)] hover:decoration-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/70"
            >
              {t("account.downloadInvoice")}
            </a>
          ) : null}
        </div>
      </div>

      {isFulfillmentStatus(order.status) ? (
        <div className="mt-4 w-full max-w-md">
          <FulfillmentTrack status={order.status} />
        </div>
      ) : null}

      <p className="mt-3 break-words text-sm leading-5 text-neutral-500">
        {order.name}, {order.address}, {order.city}, {order.country}
      </p>
    </li>
  );
}

export default function OrdersPage() {
  const user = useAuth((s) => s.user);
  const orders = useOrders((s) => s.orders);
  const syncRemote = useOrders((s) => s.syncRemote);
  const { t } = useLocale();
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
  // Do not filter by login email — the checkout email can differ from the signed-in account.
  const mine = useMemo(() => orders, [orders]);

  if (!user) {
    return (
      <div className="page-shell py-16 text-center">
        <div className="mx-auto w-full min-w-0 max-w-lg">
          <h1 className="font-[family-name:var(--font-oswald)] text-4xl uppercase">{t("account.orders")}</h1>
          <p className="mt-3 text-sm text-neutral-500">{t("account.ordersSignIn")}</p>
          <Button asChild className="mt-6">
            <Link href="/login">{t("nav.signIn")}</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <AccountFrame
      section="orders"
      crumbs={[
        { href: "/", label: t("common.home") },
        { href: "/account", label: t("account.myAccount") },
        { label: t("account.orders") },
      ]}
    >
      <header className="min-w-0">
        <h2 className="font-[family-name:var(--font-oswald)] text-[1.75rem] font-medium leading-[1.15] text-black sm:text-[2rem]">
          {t("account.orders")}
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-5 text-neutral-500">{t("account.ordersHint")}</p>
      </header>

      {loading && mine.length === 0 ? (
        <div
          className="mt-6 rounded-[var(--radius-lg)] border border-black/10 px-4 py-5 sm:px-6"
          aria-busy="true"
        >
          <div className="h-4 w-36 max-w-full rounded bg-neutral-100" />
          <div className="mt-3 h-3 w-52 max-w-full rounded bg-neutral-100" />
        </div>
      ) : mine.length === 0 ? (
        <div className="mt-6 rounded-[var(--radius-lg)] border border-black/10 px-4 py-8 sm:px-6">
          <p className="text-sm font-semibold text-black">{t("account.noOrders")}</p>
          <p className="mt-1 text-sm leading-5 text-neutral-500">{t("account.noOrdersHint")}</p>
        </div>
      ) : (
        <ul className="mt-6 w-full min-w-0 divide-y divide-black/10 overflow-hidden rounded-[var(--radius-lg)] border border-black/10">
          {mine.map((order) => (
            <OrderRow key={order.id} order={order} />
          ))}
        </ul>
      )}
    </AccountFrame>
  );
}
