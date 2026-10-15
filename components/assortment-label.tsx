"use client";

import { assortmentCopy, getAssortment, isFootwearSku, surtidoPackLines } from "@/lib/assortment";
import { useLocale } from "@/components/locale-provider";
import type { Product } from "@/lib/types";
import { cn } from "@/lib/utils";

export function AssortmentBadge({
  product,
  className,
}: {
  product: Product;
  className?: string;
}) {
  const { t, format } = useLocale();
  const info = assortmentCopy(product, t, format) ?? getAssortment(product);
  if (!info) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-normal text-[var(--text-secondary)]",
        className,
      )}
    >
      {info.label}
    </span>
  );
}

/** Each Joma pack code, with its pair count and the confirmed EU split. */
export function AssortmentCurves({
  product,
  className,
}: {
  product: Product;
  className?: string;
}) {
  const { t } = useLocale();
  const lines = surtidoPackLines(product);
  if (!lines.length) return null;
  const unit = isFootwearSku(product) ? t("product.pairs") : t("product.pcs");
  return (
    <ul className={cn("space-y-3", className)}>
      {lines.map((line) => (
        <li key={line.code}>
          <p className="text-sm font-medium text-ink">
            {line.pairs && line.pairs > 1
              ? t("product.assortmentCode", { code: line.code, n: line.pairs, unit })
              : `${line.code} · ${t("product.assortment")}`}
          </p>
          {line.split ? <p className="mt-0.5 text-sm text-[var(--muted)]">{line.split}</p> : null}
        </li>
      ))}
    </ul>
  );
}

export function AssortmentHint({
  product,
  className,
}: {
  product: Product;
  className?: string;
}) {
  const { t, format } = useLocale();
  const info = assortmentCopy(product, t, format) ?? getAssortment(product);
  if (!info?.pairHint) return null;
  return <p className={cn("text-[11px] text-[var(--muted)]", className)}>{info.pairHint}</p>;
}
