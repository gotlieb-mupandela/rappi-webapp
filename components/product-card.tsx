"use client";

import Link from "next/link";
import { type MouseEvent, useState } from "react";
import { ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import type { Product } from "@/lib/types";
import { AssortmentBadge, AssortmentHint } from "@/components/assortment-label";
import { Badge } from "@/components/ui/badge";
import { ProductImage } from "@/components/product-image";
import { StockMatrix } from "@/components/stock-matrix";
import { useLocale } from "@/components/locale-provider";
import { buyableSizes, isSoldOut, stockLabel, totalStock } from "@/lib/product-stock";
import { productCardImageUrl } from "@/lib/media";
import { useCart } from "@/lib/stores/cart";
import { productPath } from "@/lib/utils";

export function ProductCard({
  product,
  layout = "grid",
}: {
  product: Product;
  layout?: "grid" | "list";
}) {
  const add = useCart((s) => s.add);
  const { t, format } = useLocale();
  const stock = totalStock(product);
  const first = buyableSizes(product)[0];
  const soldOut = isSoldOut(product);
  const title = product.displayName || product.item;
  const cardSrc = productCardImageUrl(product);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const imageSrc = cardSrc && failedSrc !== cardSrc ? cardSrc : undefined;

  function quickAdd(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!first || soldOut) {
      toast.error(t("product.soldOutPiece"));
      return;
    }
    const result = add(product, first.size, 1);
    if (result.ok) toast.success(t(result.messageKey, result.values));
    else toast.error(t(result.messageKey, result.values));
  }

  if (layout === "list") {
    return (
      <article className="grid grid-cols-[72px_minmax(0,1fr)] items-center gap-4 py-4 sm:grid-cols-[88px_minmax(0,1fr)_auto] sm:gap-5">
        <Link
          href={productPath(product.code)}
          className="block overflow-hidden bg-[#f3f4f6]"
        >
          <ProductImage
            product={product}
            src={cardSrc}
            className="aspect-square w-full object-contain p-1.5"
            fallbackClassName="aspect-square"
          />
        </Link>
        <Link href={productPath(product.code)} className="min-w-0">
          <p className="truncate font-mono text-[11px] tracking-[0.08em] text-[var(--muted)]">
            {product.code}
          </p>
          <p className="mt-0.5 truncate text-sm font-semibold uppercase tracking-[0.04em] text-ink">
            {title}
          </p>
          <p className="price mt-1.5 text-sm font-semibold text-[var(--accent)] sm:hidden">
            {t("product.tariff", { amount: format(product.unitPrice) })}
          </p>
          <AssortmentHint product={product} className="sm:hidden" />
        </Link>
        <div className="col-span-2 flex items-center justify-between sm:col-span-1 sm:justify-end sm:gap-5">
          <div className="hidden text-right sm:block">
            <p className="price text-sm font-semibold text-[var(--accent)]">
              {t("product.tariff", { amount: format(product.unitPrice) })}
            </p>
            <AssortmentHint product={product} />
            <p className="mt-0.5 text-[11px] text-[var(--muted)]">{stockLabel(product, t)}</p>
          </div>
          <button
            type="button"
            onClick={quickAdd}
            className="flex h-10 w-10 items-center justify-center text-[var(--accent)] transition-colors hover:bg-[var(--hover)]"
            aria-label={t("common.addToBagAria", { title })}
          >
            <ShoppingBag className="h-4 w-4" />
          </button>
        </div>
      </article>
    );
  }

  return (
    <article className="group relative w-full">
      <Link href={productPath(product.code)} className="block">
        <div className="relative aspect-square overflow-hidden bg-[#f3f4f6]">
          {imageSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageSrc}
              alt={title}
              className="h-full w-full object-contain object-center p-3 transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.06] motion-reduce:transition-none motion-reduce:group-hover:scale-100 sm:p-4"
              loading="lazy"
              decoding="async"
              onError={() => {
                if (cardSrc) setFailedSrc(cardSrc);
              }}
            />
          ) : (
            <ProductImage
              product={product}
              src={null}
              className="h-full w-full"
              fallbackClassName="h-full w-full"
            />
          )}

          <div className="absolute left-2 top-2 z-10 flex max-w-[calc(100%-2.75rem)] flex-col items-start gap-1">
            {product.badge ? (
              <Badge variant={product.badge === "offer" ? "offer" : "new"}>
                {product.badge === "offer" ? t("common.offer") : t("common.new")}
              </Badge>
            ) : null}
            <AssortmentBadge product={product} />
          </div>

          {stock === 0 ? (
            <span className="absolute bottom-2 left-2 z-10 bg-[var(--accent)] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white">
              {t("common.soldOut")}
            </span>
          ) : null}

          {!soldOut ? (
            <div className="absolute inset-0 z-20 opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100 max-sm:hidden">
              <StockMatrix product={product} />
            </div>
          ) : null}
        </div>

        <div className="mt-3 space-y-0.5 text-left">
          <p className="font-mono text-[11px] tracking-[0.06em] text-[var(--muted)]">
            {product.code}
          </p>
          <p className="line-clamp-2 min-h-[2.4rem] text-[12px] font-semibold uppercase leading-snug tracking-[0.04em] text-ink transition-colors duration-200 group-hover:text-[var(--accent)]">
            {title}
          </p>
          <p className="price pt-1 text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--accent)]">
            {t("product.tariff", { amount: format(product.unitPrice) })}
          </p>
          <AssortmentHint product={product} />
        </div>
      </Link>

      <button
        type="button"
        aria-label={t("common.addToBagAria", { title })}
        onClick={quickAdd}
        className="absolute right-1.5 top-1.5 z-30 flex h-9 w-9 items-center justify-center text-[var(--accent)] transition-colors hover:bg-white/80"
      >
        <ShoppingBag className="h-4 w-4" strokeWidth={1.75} />
      </button>
    </article>
  );
}
