"use client";

import { useState } from "react";
import type { Product } from "@/lib/types";
import { ProductImage } from "@/components/product-image";
import { ScrollArea } from "@/components/ui/scroll-area";
import { productImageAlt } from "@/lib/copy";
import { cn } from "@/lib/utils";

export function ProductGallery({ product }: { product: Product }) {
  const shots =
    product.images?.length > 0
      ? product.images
      : product.imageUrl
        ? [product.imageUrl]
        : [];
  const [active, setActive] = useState(0);
  const current = shots[active] ?? shots[0];

  if (!current) {
    return (
      <div className="media-frame aspect-square w-full overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] sm:aspect-[4/5]" />
    );
  }

  const thumbs = shots.map((src, i) => (
    <button
      key={src}
      type="button"
      onClick={() => setActive(i)}
      className={cn(
        "media-frame h-20 w-20 shrink-0 overflow-hidden rounded-md border transition-[border-color,opacity] duration-300 sm:h-auto sm:w-auto sm:min-w-0",
        i === active
          ? "border-[var(--accent)] opacity-100"
          : "border-transparent opacity-55 hover:opacity-100",
      )}
      aria-label={`View photo ${i + 1}`}
      aria-current={i === active ? "true" : undefined}
    >
      <ProductImage
        product={product}
        src={src}
        alt=""
        className="aspect-square w-full object-cover"
        fallbackClassName="aspect-square"
      />
    </button>
  ));

  return (
    <div className="min-w-0">
      <div className="media-frame overflow-hidden rounded-lg border border-[var(--border)]">
        <ProductImage
          product={product}
          src={current}
          alt={productImageAlt(product, shots.length > 1 ? `photo ${active + 1}` : undefined)}
          className="pdp-stage"
          fallbackClassName="aspect-square w-full sm:aspect-[4/5]"
          priority
        />
      </div>
      {shots.length > 1 ? (
        <>
          <ScrollArea className="mt-4 w-full sm:hidden">
            <div className="flex gap-2.5 pb-1">{thumbs}</div>
          </ScrollArea>
          <div className="mt-4 hidden gap-2.5 sm:grid sm:grid-cols-5">{thumbs}</div>
        </>
      ) : null}
    </div>
  );
}
