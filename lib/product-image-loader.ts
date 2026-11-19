import type { ImageLoaderProps } from "next/image";
import { CANONICAL_SITE_ORIGIN } from "@/lib/meta/site";

const REMOTE = /^https?:\/\//i;
const SITE_TILE = /^\/joma-tiles\//;

/** Host the browser requests for resized remote product photos. */
export const PRODUCT_IMAGE_PROXY_HOST = "wsrv.nl";

/**
 * True for photos resized by wsrv instead of Vercel's image optimizer.
 * Folder tiles in public/joma-tiles count: there are too many for the optimizer quota.
 */
export function usesProductImageLoader(src: string) {
  return REMOTE.test(src) || SITE_TILE.test(src);
}

/**
 * Resize/compress photos via wsrv (Joma originals are often 1–3MB).
 * Tiles use the production origin because wsrv cannot reach localhost or env-specific hosts.
 */
export function productImageLoader({ src, width, quality }: ImageLoaderProps) {
  if (!usesProductImageLoader(src)) return src;
  const params = new URLSearchParams({
    url: SITE_TILE.test(src) ? `${CANONICAL_SITE_ORIGIN}${src}` : src,
    w: String(Math.min(Math.max(width || 640, 64), 1280)),
    output: "webp",
    q: String(quality ?? 75),
  });
  return `https://${PRODUCT_IMAGE_PROXY_HOST}/?${params.toString()}`;
}

/** Absolute resized URL for a given remote photo (used when building candidate lists). */
export function resizedProductImageUrl(src: string, width = 720, quality = 75) {
  return productImageLoader({ src, width, quality });
}
