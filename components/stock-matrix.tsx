"use client";

import type { Product } from "@/lib/types";
import { useLocale } from "@/components/locale-provider";
import {
  isSoldOut,
  pickerSizes,
  sizeDisplayLabel,
  skuStock,
} from "@/lib/product-stock";
import { cn } from "@/lib/utils";

export function StockMatrix({
  product,
  className,
}: {
  product: Product;
  className?: string;
}) {
  const { t, format } = useLocale();
  if (isSoldOut(product)) return null;

  const rows = pickerSizes(product);
  const cols =
    rows.length === 0
      ? [{ size: "SKU", stock: skuStock(product) }]
      : rows;

  if (!cols.length || cols.every((r) => r.stock <= 0)) return null;

  const price = format(product.unitPrice);

  return (
    <div
      className={cn(
        "stock-matrix pointer-events-none absolute inset-x-0 bottom-0 z-20 hidden overflow-hidden border-t border-[var(--border)] bg-white/95 shadow-[0_-8px_24px_rgba(33,47,92,0.08)] backdrop-blur-sm sm:block",
        className,
      )}
      role="table"
      aria-label={t("product.inStock", { total: skuStock(product) })}
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-full border-collapse text-[10px]">
          <thead>
            <tr className="border-b border-[var(--border)]">
              <th className="whitespace-nowrap px-2 py-1.5 text-left font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
                {t("product.size")}
              </th>
              {cols.map((col) => (
                <th
                  key={col.size}
                  className="whitespace-nowrap px-2 py-1.5 text-center font-semibold uppercase tracking-[0.08em] text-ink"
                >
                  {sizeDisplayLabel(col.size, t)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-[var(--border)]">
              <th className="whitespace-nowrap px-2 py-1.5 text-left font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
                {t("product.priceRow")}
              </th>
              {cols.map((col) => (
                <td
                  key={col.size}
                  className="price whitespace-nowrap px-2 py-1.5 text-center tabular-nums text-ink"
                >
                  {price}
                </td>
              ))}
            </tr>
            <tr className="bg-[var(--ok-muted)]">
              <th className="whitespace-nowrap px-2 py-1.5 text-left font-semibold uppercase tracking-[0.1em] text-[var(--accent)]">
                {t("product.availableStock")}
              </th>
              {cols.map((col) => (
                <td
                  key={col.size}
                  className={cn(
                    "whitespace-nowrap px-2 py-1.5 text-center font-semibold tabular-nums",
                    col.stock > 0 ? "text-[var(--ok)]" : "text-[var(--muted-2)]",
                  )}
                >
                  {col.stock}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
