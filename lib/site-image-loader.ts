"use client";

import type { ImageLoaderProps } from "next/image";
import { CANONICAL_SITE_ORIGIN } from "@/lib/meta/site";
import { productImageLoader, usesProductImageLoader } from "@/lib/product-image-loader";

/**
 * Site-wide next/image loader (next.config.ts images.loaderFile).
 *
 * Every raster image is resized by wsrv instead of Vercel Image Optimization,
 * whose monthly transformation quota the shop exceeded. Local files go through
 * the production origin because wsrv cannot reach localhost or preview hosts.
 * SVGs, data: and blob: URLs are served as they are.
 */
export default function siteImageLoader(props: ImageLoaderProps) {
  const { src } = props;
  if (usesProductImageLoader(src)) return productImageLoader(props);
  if (/^(data|blob):/i.test(src)) return src;
  if (/\.svg(\?|#|$)/i.test(src)) return src;
  if (src.startsWith("/") && !src.startsWith("//")) {
    return productImageLoader({ ...props, src: `${CANONICAL_SITE_ORIGIN}${src}` });
  }
  return src;
}
