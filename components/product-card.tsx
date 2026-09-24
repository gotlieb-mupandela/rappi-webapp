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
import TiltedCard from "@/components/tilted-card";
import { useLocale } from "@/components/locale-provider";
import { buyableSizes, isSoldOut, stockLabel, totalStock } from "@/lib/product-stock";
import { productCardImageCandidates, productCardImageUrl } from "@/lib/media";
import { useCart } from "@/lib/stores/cart";
import { productImageAlt } from "@/lib/copy";
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
  const cardSources = productCardImageCandidates(product);
  const [failedAll, setFailedAll] = useState(false);
  const imageSrc = !failedAll && cardSrc ? cardSrc : undefined;

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
      <article className="grid grid-cols-[80px_minmax(0,1fr)] items-center gap-4 border-b border-[var(--border)] py-4 sm:grid-cols-[96px_minmax(0,1fr)_auto] sm:gap-5">
        <Link href={productPath(product.code)} className="media-frame block w-20 overflow-hidden rounded-xl sm:w-24">
          <ProductImage
            product={product}
            src={cardSrc}
            sources={cardSources}
            className="aspect-square w-full object-cover"
            fallbackClassName="aspect-square"
          />
        </Link>
        <Link href={productPath(product.code)} className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <p className="min-w-0 truncate text-sm font-medium tracking-wide text-ink">{title}</p>
            <AssortmentBadge
              product={product}
              className="shrink-0 bg-[var(--text)] text-[var(--bg)]"
            />
          </div>
          <p className="mt-0.5 truncate font-mono text-[10px] tracking-[0.16em] text-[var(--muted-2)]">
            {product.code}
          </p>
          <p className="price mt-1 text-sm font-semibold sm:hidden">
            {format(product.unitPrice)}
          </p>
          <AssortmentHint product={product} className="sm:hidden" />
          <p className="text-[11px] text-[var(--muted)] sm:hidden">{stockLabel(product, t)}</p>
        </Link>
        <div className="col-span-2 flex items-center justify-between sm:col-span-1 sm:justify-end sm:gap-4">
          <div className="hidden sm:block">
            <p className="price text-sm font-semibold">{format(product.unitPrice)}</p>
            <AssortmentHint product={product} />
            <p className="text-[11px] text-[var(--muted)]">{stockLabel(product, t)}</p>
          </div>
          <button
            type="button"
            onClick={quickAdd}
            className="flex h-10 w-10 items-center justify-center rounded-full text-[var(--accent)] transition-colors hover:bg-[var(--hover)]"
            aria-label={t("common.addToBagAria", { title })}
          >
            <ShoppingBag className="h-4 w-4" />
          </button>
        </div>
      </article>
    );
  }

  return (
    <article className="product-card group relative w-full max-w-sm">
      <Link href={productPath(product.code)} className="block">
        <TiltedCard
          imageSrc={imageSrc}
          imageSrcs={failedAll ? [] : cardSources}
          altText={productImageAlt(product)}
          captionText={title}
          containerHeight="auto"
          containerWidth="100%"
          imageHeight="auto"
          imageWidth="100%"
          rotateAmplitude={16}
          scaleOnHover={1.07}
          showMobileWarning={false}
          showTooltip
          displayOverlayContent
          onImageError={() => setFailedAll(true)}
          imageClassName="bg-[var(--bg-elevated)]"
          overlayContent={
            <>
              <div className="absolute left-3 top-3 z-10 flex max-w-[calc(100%-3.5rem)] flex-col items-start gap-1.5">
                {product.badge ? (
                  <Badge variant={product.badge === "offer" ? "offer" : "new"}>
                    {product.badge === "offer" ? t("common.offer") : t("common.new")}
                  </Badge>
                ) : null}
                <AssortmentBadge product={product} />
              </div>
              {stock === 0 ? (
                <span className="absolute bottom-3 left-3 z-10 rounded-md bg-[var(--accent)]/85 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white backdrop-blur-sm">
                  {t("common.soldOut")}
                </span>
              ) : null}
              <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-t from-[var(--accent-dim)]/45 via-transparent to-white/10 opacity-70 transition-opacity duration-300 group-hover:opacity-100 group-focus-within:opacity-100" />
              {!soldOut ? (
                <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100 max-sm:hidden">
                  <StockMatrix product={product} />
                </div>
              ) : null}
            </>
          }
        />
        <div className="mt-4 space-y-1 text-left">
          <p className="text-[14px] font-semibold leading-snug tracking-[-0.01em] text-ink transition-colors duration-300 group-hover:text-[var(--accent)]">
            {title}
          </p>
          <p className="font-mono text-[10px] tracking-[0.16em] text-[var(--muted-2)]">
            {product.code}
          </p>
          <p className="price pt-1.5 font-[family-name:var(--font-display)] text-lg font-bold uppercase tracking-wide text-[var(--text-secondary)]">
            {format(product.unitPrice)}
          </p>
          <AssortmentHint product={product} />
          <p className="text-[11px] text-[var(--muted)] transition-opacity duration-200 sm:group-hover:opacity-0">
            {stockLabel(product, t)}
          </p>
        </div>
      </Link>
      <button
        type="button"
        aria-label={t("common.addToBagAria", { title })}
        onClick={quickAdd}
        className="absolute right-3 top-3 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-[var(--accent)] text-[var(--on-accent)] opacity-100 shadow-[var(--shadow-volume)] transition-[opacity,transform,background-color] duration-300 hover:bg-[var(--accent-bright)] hover:scale-105 active:scale-95 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
      >
        <ShoppingBag className="h-4 w-4" />
      </button>
    </article>
  );
}
