"use client";

import Link from "next/link";
import { useMemo } from "react";
import { toast } from "sonner";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { ProductImage } from "@/components/product-image";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/components/locale-provider";
import { cartCount, cartLineAsProduct, useCart } from "@/lib/stores/cart";
import { QtyStepper } from "@/components/qty-stepper";
import { sizeDisplayLabel } from "@/lib/product-stock";
import { productPath } from "@/lib/utils";

export default function CartPage() {
  const lines = useCart((s) => s.lines);
  const setQty = useCart((s) => s.setQty);
  const remove = useCart((s) => s.remove);
  const clear = useCart((s) => s.clear);
  const count = cartCount(lines);
  const { t, format } = useLocale();

  const rows = useMemo(
    () =>
      lines.map((line) => ({
        line,
        product: cartLineAsProduct(line),
        lineTotal: line.price * line.qty,
      })),
    [lines],
  );

  const subtotal = rows.reduce((s, r) => s + r.lineTotal, 0);

  return (
    <div className="page-shell py-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Breadcrumbs items={[{ href: "/", label: t("common.home") }, { label: t("cart.crumb") }]} />
          <h1 className="mt-4 font-[family-name:var(--font-oswald)] text-3xl font-bold uppercase text-[var(--text-secondary)] sm:text-5xl">
            {t("cart.title")}
          </h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {count ? t.plural("count.pieces", count) : t("cart.empty")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => {
              clear();
              toast.message(t("cart.emptied"));
            }}
            disabled={!rows.length}
          >
            {t("cart.emptyBag")}
          </Button>
          <Button asChild disabled={!rows.length}>
            <Link href="/checkout">{t("common.checkout")}</Link>
          </Button>
        </div>
      </div>

      {!rows.length ? (
        <div className="mt-10 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-6 py-16 text-center">
          <p className="text-lg font-semibold">{t("cart.empty")}</p>
          <p className="mt-2 text-sm text-[var(--muted)]">
            {t("cart.emptyHint")}
          </p>
          <Button asChild className="mt-6">
            <Link href="/">{t("common.continueShopping")}</Link>
          </Button>
        </div>
      ) : (
        <div className="mt-8 space-y-4">
          {rows.map(({ line, product, lineTotal }) => (
            <div
              key={`${line.code}-${line.size}`}
              className="grid gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:grid-cols-[96px_minmax(0,1fr)] sm:gap-4"
            >
              <Link href={productPath(product.code)} className="media-frame block w-20 overflow-hidden rounded-lg sm:w-24">
                <ProductImage
                  product={product}
                  src={line.imageUrl}
                  className="aspect-square w-full object-cover"
                  fallbackClassName="aspect-square"
                />
              </Link>
              <div className="min-w-0">
                <Link href={productPath(product.code)} className="font-mono text-base font-bold hover:text-[var(--accent)] sm:text-lg">
                  {product.code}
                </Link>
                <p className="mt-0.5 line-clamp-2 text-xs uppercase tracking-wider text-[var(--muted)]">
                  {product.name}
                </p>
                <p className="mt-2 text-sm text-[var(--muted)]">
                  {t("cart.size")}{" "}
                  <span className="font-semibold text-ink">{sizeDisplayLabel(line.size, t)}</span>
                  <span className="mx-2 text-[var(--border-strong)]">·</span>
                  {format(line.price)}
                </p>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                  <QtyStepper
                    value={line.qty}
                    min={0}
                    max={line.sizeStock}
                    onChange={(next) => setQty(line.code, line.size, next)}
                    className="h-11 [&_button]:h-11 [&_button]:w-11"
                  />
                  <div className="flex items-center gap-3">
                    <p className="price text-base font-semibold">{format(lineTotal)}</p>
                    <button
                      type="button"
                      onClick={() => remove(line.code, line.size)}
                      className="inline-flex min-h-11 items-center rounded-full px-3 text-xs font-semibold uppercase tracking-wider text-[var(--muted)] hover:bg-[var(--hover)] hover:text-ink"
                    >
                      {t("common.remove")}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
          <div className="sticky bottom-0 z-20 flex flex-col gap-3 rounded-xl border border-[var(--border-strong)] bg-white/95 px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[var(--shadow-soft)] backdrop-blur-xl sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:px-5">
            <p className="text-sm uppercase tracking-wider text-[var(--muted)]">
              {t.plural("count.units", count)}
            </p>
            <p className="text-xl font-semibold">
              {t("cart.subtotal", { amount: format(subtotal) })}
            </p>
            <Button asChild size="lg" className="w-full sm:w-auto">
              <Link href="/checkout">{t("common.checkout")}</Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
