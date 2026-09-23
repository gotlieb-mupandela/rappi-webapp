"use client";

import { assortmentCopy, getAssortment } from "@/lib/assortment";
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
