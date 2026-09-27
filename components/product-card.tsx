"use client";

import Link from "next/link";
import {
  type MouseEvent as ReactMouseEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import type { Product } from "@/lib/types";
import { ProductImage } from "@/components/product-image";
import { StockMatrix } from "@/components/stock-matrix";
import { useLocale } from "@/components/locale-provider";
import { productImageAlt } from "@/lib/copy";
import { buyableSizes, isSoldOut } from "@/lib/product-stock";
import { productCardImageCandidates, productCardImageUrl } from "@/lib/media";
import { useCart } from "@/lib/stores/cart";
import { productPath } from "@/lib/utils";

const CURSOR_GAP = 14;

/** Joma B2B listing — stock table portals to body and follows the cursor. */
export function ProductCard({
  product,
  layout = "grid",
}: {
  product: Product;
  layout?: "grid" | "list";
}) {
  const add = useCart((s) => s.add);
  const { t, format } = useLocale();
  const first = buyableSizes(product)[0];
  const soldOut = isSoldOut(product);
  const title = product.displayName || product.item;
  const cardSrc = productCardImageUrl(product);
  const cardSources = productCardImageCandidates(product);

  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const popRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef({ x: 0, y: 0 });
  const rafRef = useRef(0);

  useEffect(() => {
    setMounted(true);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  function placePopover() {
    const el = popRef.current;
    if (!el) return;
    const { x, y } = cursorRef.current;
    const w = el.offsetWidth || 280;
    const h = el.offsetHeight || 96;
    const maxL = window.innerWidth - w - 8;
    const maxT = window.innerHeight - h - 8;
    let left = x + CURSOR_GAP;
    let top = y + CURSOR_GAP;
    if (left > maxL) left = x - w - CURSOR_GAP;
    if (top > maxT) top = y - h - CURSOR_GAP;
    left = Math.max(8, Math.min(left, maxL));
    top = Math.max(8, Math.min(top, maxT));
    el.style.transform = `translate3d(${left}px, ${top}px, 0)`;
  }

  function schedulePlace() {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0;
      placePopover();
    });
  }

  function onCardEnter(e: ReactMouseEvent) {
    if (soldOut) return;
    cursorRef.current = { x: e.clientX, y: e.clientY };
    setOpen(true);
    // Place after paint so width/height are known.
    requestAnimationFrame(() => {
      placePopover();
      requestAnimationFrame(placePopover);
    });
  }

  function onCardMove(e: ReactMouseEvent) {
    if (soldOut || !open) return;
    cursorRef.current = { x: e.clientX, y: e.clientY };
    schedulePlace();
  }

  function onCardLeave() {
    setOpen(false);
  }

  function quickAdd(e: ReactMouseEvent) {
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
      <article className="grid grid-cols-[72px_minmax(0,1fr)_auto] items-center gap-4 border-b border-[var(--border)] py-3">
        <Link
          href={productPath(product.code)}
          className="block overflow-hidden bg-[#f3f4f6]"
        >
          <ProductImage
            product={product}
            src={cardSrc}
            sources={cardSources}
            alt={productImageAlt(product)}
            className="aspect-square w-full object-contain p-1.5"
            fallbackClassName="aspect-square"
          />
        </Link>
        <Link href={productPath(product.code)} className="min-w-0">
          <p className="truncate font-mono text-[11px] text-[var(--muted)]">{product.code}</p>
          <p className="mt-0.5 truncate text-[12px] font-semibold uppercase tracking-[0.02em] text-[var(--text)]">
            {title}
          </p>
          <p className="price mt-1 text-[12px] font-semibold text-[var(--accent)]">
            {t("product.tariff", { amount: format(product.unitPrice) })}
          </p>
        </Link>
        <button
          type="button"
          onClick={quickAdd}
          className="flex h-9 w-9 items-center justify-center text-[var(--muted)] transition-colors hover:text-[var(--accent)]"
          aria-label={t("common.addToBagAria", { title })}
        >
          <ShoppingBag className="h-4 w-4" strokeWidth={1.5} />
        </button>
      </article>
    );
  }

  return (
    <article
      className="relative w-full"
      onMouseEnter={onCardEnter}
      onMouseMove={onCardMove}
      onMouseLeave={onCardLeave}
    >
      <Link href={productPath(product.code)} className="block">
        <div className="relative aspect-square overflow-hidden bg-[#f3f4f6]">
          <ProductImage
            product={product}
            src={cardSrc}
            sources={cardSources}
            alt={productImageAlt(product)}
            className="h-full w-full object-contain object-center p-3 sm:p-4"
            fallbackClassName="h-full w-full"
          />
          {soldOut ? (
            <span className="absolute bottom-2 left-2 z-10 bg-[var(--accent)] px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-white">
              {t("common.soldOut")}
            </span>
          ) : null}
        </div>
        <div className="mt-2.5 space-y-0.5 text-left">
          <p className="font-mono text-[11px] leading-none text-[var(--muted)]">{product.code}</p>
          <p className="line-clamp-2 min-h-[2.25rem] text-[11px] font-semibold uppercase leading-snug tracking-[0.02em] text-[var(--text)] sm:text-[12px]">
            {title}
          </p>
          <p className="price pt-0.5 text-[12px] font-semibold text-[var(--accent)]">
            {t("product.tariff", { amount: format(product.unitPrice) })}
          </p>
        </div>
      </Link>

      <button
        type="button"
        aria-label={t("common.addToBagAria", { title })}
        onClick={quickAdd}
        className="absolute right-1.5 top-1.5 z-10 flex h-8 w-8 items-center justify-center text-[var(--muted)] transition-colors hover:bg-white/90 hover:text-[var(--accent)]"
      >
        <ShoppingBag className="h-4 w-4" strokeWidth={1.5} />
      </button>

      {mounted && open && !soldOut
        ? createPortal(
            <div
              ref={popRef}
              role="presentation"
              className="stock-matrix-follow pointer-events-none fixed left-0 top-0 z-[90] hidden will-change-transform sm:block"
            >
              <StockMatrix product={product} />
            </div>,
            document.body,
          )
        : null}
    </article>
  );
}
