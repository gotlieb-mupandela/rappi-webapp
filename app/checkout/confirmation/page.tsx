"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/components/locale-provider";
import { formatDate } from "@/lib/format";
import { translateStoredShipping } from "@/lib/i18n/labels";
import { useOrders } from "@/lib/stores/orders";
import { formatVatRate } from "@/lib/vat";

function ConfirmationInner() {
  const params = useSearchParams();
  const id = params.get("id");
  const order = useOrders((s) => s.orders.find((o) => o.id === id));
  const { t, format, market } = useLocale();

  if (!order) {
    return (
      <div className="mx-auto max-w-[720px] px-4 py-16 text-center">
        <h1 className="font-[family-name:var(--font-oswald)] text-4xl uppercase">
          {t("checkout.orderNotFound")}
        </h1>
        <p className="mt-3 text-sm text-[var(--muted)]">
          {t("checkout.confirmationHint")}
        </p>
        <Button asChild className="mt-6">
          <Link href="/account/orders">{t("checkout.viewOrders")}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[900px] px-4 py-8 lg:px-6">
      <Breadcrumbs
        items={[
          { href: "/", label: t("common.home") },
          { href: "/cart", label: t("cart.crumb") },
          { label: t("checkout.confirmation") },
        ]}
      />
      <p className="mt-6 text-xs uppercase tracking-[0.2em] text-[var(--accent)]">
        {t("checkout.orderPlaced")}
      </p>
      <h1 className="mt-2 font-[family-name:var(--font-oswald)] text-4xl uppercase">
        {order.id}
      </h1>
      <p className="mt-2 text-sm text-[var(--muted)]">{formatDate(order.createdAt)}</p>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <h2 className="text-sm font-bold uppercase tracking-wider">{t("checkout.shipTo")}</h2>
          <p className="mt-3 text-sm leading-6">
            {order.name}
            <br />
            {order.address}
            <br />
            {order.city}, {order.country}
            <br />
            {order.email}
          </p>
          <p className="mt-3 text-sm text-[var(--muted)]">
            {translateStoredShipping(order.shippingMethod, t)}
          </p>
        </section>
        <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <h2 className="text-sm font-bold uppercase tracking-wider">{t("checkout.totals")}</h2>
          <p className="mt-3 flex justify-between text-sm">
            <span>{t("checkout.merchandise")}</span>
            <span>{format(order.subtotal)}</span>
          </p>
          <p className="flex justify-between text-sm">
            <span>{t("checkout.shipping")}</span>
            <span>{format(order.shippingCost)}</span>
          </p>
          <p className="flex justify-between text-sm">
            <span>{t("checkout.vat", { rate: formatVatRate(order.vatRate ?? 0) })}</span>
            <span>{format(order.vatAmount ?? 0)}</span>
          </p>
          <p className="mt-2 flex justify-between text-lg font-semibold">
            <span>{market === "eu" ? t("checkout.totalEur") : t("checkout.totalNad")}</span>
            <span>{format(order.total)}</span>
          </p>
        </section>
      </div>

      <section className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <h2 className="text-sm font-bold uppercase tracking-wider">{t("checkout.items")}</h2>
        <ul className="mt-3 divide-y divide-[var(--border)] text-sm">
          {order.items.map((item) => (
            <li key={`${item.code}-${item.size}`} className="flex flex-col gap-1 py-2 sm:flex-row sm:justify-between">
              <span className="break-words">
                {item.code} · {item.name} · {item.size} × {item.qty}
              </span>
              <span className="shrink-0 font-semibold">{format(item.price * item.qty)}</span>
            </li>
          ))}
        </ul>
      </section>

      <div className="mt-8 flex flex-wrap gap-3">
        <Button asChild>
          <Link href="/account/orders">{t("checkout.viewInAccount")}</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/">{t("common.continueShopping")}</Link>
        </Button>
      </div>
    </div>
  );
}

export default function ConfirmationPage() {
  return (
    <Suspense>
      <ConfirmationInner />
    </Suspense>
  );
}
