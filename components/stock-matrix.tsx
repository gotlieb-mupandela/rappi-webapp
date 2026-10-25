"use client";

import type { Product } from "@/lib/types";
import { useLocale } from "@/components/locale-provider";
import { clientAssortment, curveSplitText, renderAssortmentLabel, surtidoSizeLabel } from "@/lib/assortment";
import {
  isSoldOut,
  pickerSizes,
  sizeDisplayLabel,
  skuStock,
} from "@/lib/product-stock";
import { cn } from "@/lib/utils";

type MatrixCol = { size: string; label: string; stock: number; split: string | null };

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
  const packView = clientAssortment(product);
  const bySize = new Map(packView.sizes.map((row) => [row.size, row]));
  const labelFor = (size: string) => {
    const row = bySize.get(size);
    if (row) return renderAssortmentLabel(row.labelKey, row.labelParams, t, row.label) ?? row.label;
    return surtidoSizeLabel(product, size, t);
  };
  const labeled = rows.flatMap((col) => {
    const label = labelFor(col.size);
    if (!label) return [];
    const split = bySize.get(col.size)?.split ?? curveSplitText(col.size);
    return [{ size: col.size, label, stock: col.stock, split }];
  });
  const cols: MatrixCol[] =
    labeled.length > 0
      ? labeled
      : rows.length === 0
        ? [
            {
              size: "SKU",
              label: labelFor("SKU") ?? sizeDisplayLabel("SKU", t),
              stock: skuStock(product),
              split: null,
            },
          ]
        : rows.map((col) => ({
            size: col.size,
            label: sizeDisplayLabel(col.size, t),
            stock: col.stock,
            split: null,
          }));
  const splits = cols.filter((col) => col.split);

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
      {splits.length ? (
        <div className="space-y-1 border-t border-black/15 px-2 py-1.5 text-left text-[10px] leading-snug text-ink">
          {splits.map((col) => (
            <p key={col.size}>
              <span className="font-semibold">{col.label}</span>
              {": "}
              {col.split}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}
