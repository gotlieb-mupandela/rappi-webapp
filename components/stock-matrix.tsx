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

/** Full size/price/stock panel — no clipped scroll; all columns visible. */
export function StockMatrix({
  product,
  className,
}: {
  product: Product;
  className?: string;
}) {
  const { t, format, market } = useLocale();
  if (isSoldOut(product)) return null;

  const rows = pickerSizes(product);
  const cols =
    rows.length === 0
      ? [{ size: "SKU", stock: skuStock(product) }]
      : rows;

  if (!cols.length || cols.every((r) => r.stock <= 0)) return null;

  const price = format(product.unitPrice);
  const currency = market === "eu" ? "EUR" : "NAD";

  return (
    <div
      className={cn(
        "stock-matrix border border-black/25 bg-white shadow-[0_10px_32px_rgba(0,0,0,0.18)]",
        className,
      )}
      role="table"
      aria-label={t("product.inStock", { total: skuStock(product) })}
    >
      <table className="w-max border-collapse text-[10px] leading-none">
        <thead>
          <tr className="border-b border-black/15">
            <th className="whitespace-nowrap px-2 py-1.5 text-left font-semibold uppercase tracking-[0.06em] text-[var(--muted)]">
              {t("product.size")}
            </th>
            {cols.map((col) => (
              <th
                key={col.size}
                className="whitespace-nowrap px-2.5 py-1.5 text-center font-semibold uppercase tracking-[0.04em] text-ink"
              >
                {sizeDisplayLabel(col.size, t)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-black/15">
            <th className="whitespace-nowrap px-2 py-1.5 text-left font-semibold uppercase tracking-[0.06em] text-[var(--muted)]">
              {t("product.priceRow")}
              <span className="ml-1 font-medium normal-case tracking-normal">
                | {currency} |
              </span>
            </th>
            {cols.map((col) => (
              <td
                key={col.size}
                className="price whitespace-nowrap px-2.5 py-1.5 text-center tabular-nums text-ink"
              >
                {price}
              </td>
            ))}
          </tr>
          <tr className="bg-[#c8e6c9]">
            <th className="whitespace-nowrap px-2 py-1.5 text-left font-bold uppercase tracking-[0.06em] text-[var(--text)]">
              {t("product.availableStock")}
            </th>
            {cols.map((col) => (
              <td
                key={col.size}
                className={cn(
                  "whitespace-nowrap px-2.5 py-1.5 text-center font-semibold tabular-nums text-[var(--text)]",
                  col.stock <= 0 && "text-[var(--muted-2)]",
                )}
              >
                {col.stock}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
