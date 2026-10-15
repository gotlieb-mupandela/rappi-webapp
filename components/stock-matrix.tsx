"use client";

import type { Product } from "@/lib/types";
import { useLocale } from "@/components/locale-provider";
import { surtidoSizeLabel } from "@/lib/assortment";
import {
  isSoldOut,
  pickerSizes,
  sizeDisplayLabel,
  skuStock,
} from "@/lib/product-stock";
import { cn } from "@/lib/utils";

type MatrixCol = { size: string; label: string; stock: number };

/** Mixed surtido curves share one label. Show that pack once, not S05 and S09. */
function collapseAssortmentColumns(cols: MatrixCol[]): MatrixCol[] {
  if (cols.length < 2) return cols;
  const label = cols[0]?.label;
  if (!label || !/assort/i.test(label)) return cols;
  if (!cols.every((col) => col.label === label)) return cols;
  return [
    {
      size: "PACK",
      label,
      stock: cols.reduce((sum, col) => sum + col.stock, 0),
    },
  ];
}

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
  const labeled = rows.flatMap((col) => {
    const label = surtidoSizeLabel(product, col.size, t);
    return label ? [{ size: col.size, label, stock: col.stock }] : [];
  });
  const cols = collapseAssortmentColumns(
    labeled.length > 0
      ? labeled
      : rows.length === 0
        ? [
            {
              size: "SKU",
              label: surtidoSizeLabel(product, "SKU", t) ?? sizeDisplayLabel("SKU", t),
              stock: skuStock(product),
            },
          ]
        : rows.map((col) => ({
            size: col.size,
            label: sizeDisplayLabel(col.size, t),
            stock: col.stock,
          })),
  );

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
                {col.label}
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
