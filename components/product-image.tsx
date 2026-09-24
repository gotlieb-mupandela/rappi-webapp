"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import type { Product } from "@/lib/types";
import { productImageAlt } from "@/lib/copy";
import { productImageLoader } from "@/lib/product-image-loader";
import { cn } from "@/lib/utils";

/** Empty media plate — never silhouette shapes. */
function ImagePlate({ className }: { className?: string }) {
  return (
    <div
      className={cn("bg-[var(--bg-elevated)]", className)}
      aria-hidden
    />
  );
}

/**
 * Product photos are multi‑MB on Joma CDNs. We resize via wsrv.nl (custom loader)
 * and walk fallback sources when a URL fails.
 */
export function ProductImage({
  product,
  src,
  sources,
  alt,
  className,
  fallbackClassName,
  priority = false,
  fill = false,
  sizes = "(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 280px",
  width = 720,
  height = 720,
  quality = 75,
}: {
  product: Product;
  src?: string | null;
  /** Preferred ordered fallbacks (e.g. medium → joma.net). */
  sources?: string[] | null;
  alt?: string;
  className?: string;
  fallbackClassName?: string;
  priority?: boolean;
  fill?: boolean;
  sizes?: string;
  width?: number;
  height?: number;
  quality?: number;
}) {
  const candidates = useMemo(() => {
    // Prefer the explicit `src` (active gallery shot / card primary), then walk
    // `sources` as fallbacks. Never drop `src` when sources is non-empty —
    // that made every PDP thumbnail render the first gallery URL.
    const list = [src, ...(sources ?? [])].filter(
      (url): url is string => Boolean(url),
    );
    return [...new Set(list)];
  }, [src, sources]);

  const [index, setIndex] = useState(0);
  const [exhausted, setExhausted] = useState(false);

  useEffect(() => {
    setIndex(0);
    setExhausted(false);
  }, [candidates]);

  const current = !exhausted ? candidates[index] : undefined;

  if (!current) {
    return <ImagePlate className={fallbackClassName ?? className} />;
  }

  const remote = /^https?:\/\//i.test(current);

  function advance() {
    setIndex((prev) => {
      if (prev + 1 < candidates.length) return prev + 1;
      setExhausted(true);
      return prev;
    });
  }

  if (fill) {
    return (
      <Image
        key={current}
        src={current}
        alt={alt ?? productImageAlt(product)}
        fill
        sizes={sizes}
        quality={quality}
        priority={priority}
        className={className}
        loader={remote ? productImageLoader : undefined}
        unoptimized={!remote}
        onError={advance}
      />
    );
  }

  return (
    <Image
      key={current}
      src={current}
      alt={alt ?? productImageAlt(product)}
      width={width}
      height={height}
      sizes={sizes}
      quality={quality}
      priority={priority}
      className={className}
      loader={remote ? productImageLoader : undefined}
      unoptimized={!remote}
      onError={advance}
    />
  );
}
