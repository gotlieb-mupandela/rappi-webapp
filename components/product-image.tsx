"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import type { Product } from "@/lib/types";
import { productImageAlt } from "@/lib/copy";
import { productImageLoader } from "@/lib/product-image-loader";
import { cn } from "@/lib/utils";

/** One retry per URL, then walk the next fallback. */
const RETRIES_PER_URL = 1;

type LoadState = {
  key: string;
  index: number;
  attempt: number;
  exhausted: boolean;
};

/** Empty media plate. Never silhouette shapes. */
function ImagePlate({ className }: { className?: string }) {
  return (
    <div
      className={cn("bg-[var(--bg-elevated)]", className)}
      aria-hidden
    />
  );
}

/**
 * Product photos are multi-MB on supplier CDNs. We resize via wsrv.nl (custom loader)
 * and walk fallback sources when a URL fails. Each URL is retried once first.
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
  /** Preferred ordered fallbacks (medium, then joma.net). */
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
    // `sources` as fallbacks. Never drop `src` when sources is non-empty.
    // Dropping it made every PDP thumbnail render the first gallery URL.
    const list = [src, ...(sources ?? [])].filter(
      (url): url is string => Boolean(url),
    );
    return [...new Set(list)];
  }, [src, sources]);

  const sourceKey = candidates.join("\n");
  const [load, setLoad] = useState<LoadState>({
    key: sourceKey,
    index: 0,
    attempt: 0,
    exhausted: false,
  });

  if (load.key !== sourceKey) {
    setLoad({
      key: sourceKey,
      index: 0,
      attempt: 0,
      exhausted: false,
    });
  }

  const active =
    load.key === sourceKey
      ? load
      : { key: sourceKey, index: 0, attempt: 0, exhausted: false };
  const current = !active.exhausted ? candidates[active.index] : undefined;

  if (!current) {
    return <ImagePlate className={fallbackClassName ?? className} />;
  }

  const remote = /^https?:\/\//i.test(current);

  function advance() {
    setLoad((prev) => {
      if (prev.key !== sourceKey) {
        return { key: sourceKey, index: 0, attempt: 0, exhausted: false };
      }
      if (prev.attempt < RETRIES_PER_URL) {
        return { ...prev, attempt: prev.attempt + 1 };
      }
      if (prev.index + 1 < candidates.length) {
        return { ...prev, index: prev.index + 1, attempt: 0, exhausted: false };
      }
      return { ...prev, exhausted: true };
    });
  }

  if (fill) {
    return (
      <Image
        key={`${current}:${active.attempt}`}
        src={current}
        alt={alt ?? productImageAlt(product)}
        fill
        sizes={sizes}
        quality={quality}
        priority={priority}
        className={className}
        loader={remote ? productImageLoader : undefined}
        onError={advance}
      />
    );
  }

  return (
    <Image
      key={`${current}:${active.attempt}`}
      src={current}
      alt={alt ?? productImageAlt(product)}
      width={width}
      height={height}
      sizes={sizes}
      quality={quality}
      priority={priority}
      className={className}
      loader={remote ? productImageLoader : undefined}
      onError={advance}
    />
  );
}
