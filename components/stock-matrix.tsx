"use client";

import type { Product } from "@/lib/types";
import { useT } from "@/components/locale-provider";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  const t = useT();
  if (isSoldOut(product)) return null;

  const rows = pickerSizes(product);
  const fallback =
    rows.length === 0
      ? [{ size: "SKU", stock: skuStock(product) }]
      : rows;

  if (!fallback.length || fallback.every((r) => r.stock <= 0)) return null;

  return (
    <div
      className={cn(
        "stock-matrix pointer-events-none absolute inset-x-2 bottom-2 z-20 hidden overflow-hidden rounded-xl border border-[var(--border)] sm:block",
        className,
      )}
      role="table"
      aria-label={t("product.inStock", { total: skuStock(product) })}
    >
      <div className="grid grid-cols-[1fr_auto] gap-x-3 border-b border-[var(--border)] bg-[var(--surface-2)] px-3 py-1.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
        <span>{t("product.size")}</span>
        <span className="text-right">{t("home.statStock")}</span>
      </div>
      <ScrollArea className="max-h-36 bg-white/90">
        <ul>
          {fallback.map((row) => {
            const available = row.stock > 0;
            return (
              <li
                key={row.size}
                className={cn(
                  "grid grid-cols-[1fr_auto] gap-x-3 border-b border-[var(--border)] px-3 py-1.5 text-[11px] last:border-b-0",
                  available
                    ? "bg-[var(--ok-muted)] text-[var(--text)]"
                    : "text-[var(--muted-2)]",
                )}
              >
                <span className="font-medium tabular-nums">
                  {sizeDisplayLabel(row.size, t)}
                </span>
                <span
                  className={cn(
                    "text-right font-semibold tabular-nums",
                    available ? "text-[var(--ok)]" : "text-[var(--muted-2)]",
                  )}
                >
                  {row.stock}
                </span>
              </li>
            );
          })}
        </ul>
      </ScrollArea>
    </div>
  );
}
