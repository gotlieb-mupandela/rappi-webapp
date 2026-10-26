"use client";

import {
  assortmentCopy,
  clientAssortment,
  getAssortment,
  renderAssortmentLabel,
  surtidoCurveSizes,
} from "@/lib/assortment";
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
  const view = clientAssortment(product);
  const info = assortmentCopy(product, t, format) ?? getAssortment(product);
  const label = renderAssortmentLabel(view.labelKey, view.labelParams, t, view.label) ?? info?.label ?? null;
  if (!label) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-normal text-[var(--text-secondary)]",
        className,
      )}
    >
      {label}
    </span>
  );
}

/** Each pack code, with its pair count and the confirmed EU split. */
export function AssortmentCurves({
  product,
  className,
}: {
  product: Product;
  className?: string;
}) {
  const { t } = useLocale();
  const curves = surtidoCurveSizes(product);
  if (!curves?.length) return null;
  const bySize = new Map(clientAssortment(product).sizes.map((row) => [row.size.toUpperCase(), row]));
  const lines = curves.flatMap((size) => {
    const row = bySize.get(size.toUpperCase());
    return row ? [row] : [];
  });
  if (!lines.length) return null;
  return (
    <ul className={cn("space-y-3", className)}>
      {lines.map((line) => (
        <li key={line.size}>
          <p className="text-sm font-medium text-ink">
            {renderAssortmentLabel(line.labelKey, line.labelParams, t, line.label)}
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
