import type { ImageLoaderProps } from "next/image";

const REMOTE = /^https?:\/\//i;

/** Resize/compress remote product photos via wsrv (Joma originals are often 1–3MB). */
export function productImageLoader({ src, width, quality }: ImageLoaderProps) {
  if (!REMOTE.test(src)) return src;
  const params = new URLSearchParams({
    url: src,
    w: String(Math.min(Math.max(width || 640, 64), 1280)),
    output: "webp",
    q: String(quality ?? 75),
  });
  return `https://wsrv.nl/?${params.toString()}`;
}

/** Absolute resized URL for a given remote photo (used when building candidate lists). */
export function resizedProductImageUrl(src: string, width = 720, quality = 75) {
  return productImageLoader({ src, width, quality });
}
