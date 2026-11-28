import "server-only";

import type { PDFDocument, PDFImage, PDFPage } from "pdf-lib";
import { CANONICAL_SITE_ORIGIN } from "@/lib/meta/site";
import { PRODUCT_IMAGE_PROXY_HOST } from "@/lib/product-image-loader";
import { getFreshCheckoutProducts } from "@/lib/supabase/catalog";

/** Square box, in PDF points, that each item photo is fitted into. */
export const PDF_PHOTO_SIZE = 42;
/** Horizontal space the photo column takes, including the gap before the code. */
export const PDF_PHOTO_COLUMN = PDF_PHOTO_SIZE + 10;

const FETCH_WIDTH = 160;
const MAX_PHOTOS = 60;
const CONCURRENCY = 6;
const TOTAL_TIMEOUT_MS = 6000;
const MAX_BYTES = 600_000;

/** Absolute URL of the photo the storefront shows for a product, or null. */
function photoSource(url: string | null | undefined) {
  if (!url) return null;
  const clean = url.split("?")[0] ?? "";
  // AI renders are never shown on the storefront, so never on documents either.
  if (/\/ai-[^/]*$/i.test(clean)) return null;
  if (/^https?:\/\//i.test(url)) return url;
  // `/products/...` paths are placeholders that do not exist.
  if (url.startsWith("/") && !url.startsWith("/products/")) return `${CANONICAL_SITE_ORIGIN}${url}`;
  return null;
}

/** Small white-backed JPEG via the same resizer the storefront uses (pdf-lib cannot embed WebP). */
function thumbnailUrl(src: string) {
  const params = new URLSearchParams({
    url: src,
    w: String(FETCH_WIDTH),
    h: String(FETCH_WIDTH),
    fit: "contain",
    bg: "white",
    output: "jpg",
    q: "80",
  });
  return `https://${PRODUCT_IMAGE_PROXY_HOST}/?${params.toString()}`;
}

async function fetchJpeg(url: string, signal: AbortSignal) {
  const res = await fetch(url, { signal, cache: "no-store" });
  if (!res.ok) return null;
  const type = res.headers.get("content-type") ?? "";
  if (!/image\/jpe?g/i.test(type)) return null;
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (!bytes.length || bytes.length > MAX_BYTES) return null;
  return bytes;
}

/**
 * Embeds the storefront photo of each item code into `doc`.
 * Codes without a photo, or whose photo cannot be fetched in time, are left out,
 * so the document still renders when the image host is slow or down.
 */
export async function embedItemPhotos(doc: PDFDocument, codes: string[]) {
  const photos = new Map<string, PDFImage>();
  const unique = [...new Set(codes.map((code) => code.trim()).filter(Boolean))].slice(0, MAX_PHOTOS);
  if (!unique.length) return photos;

  let products: Awaited<ReturnType<typeof getFreshCheckoutProducts>>;
  try {
    products = await getFreshCheckoutProducts(unique);
  } catch (err) {
    console.error("pdf item photos: catalog lookup failed", err);
    return photos;
  }

  const jobs = unique
    .map((code) => {
      const product = products.get(code);
      const src = photoSource(product?.imageUrl) ?? photoSource(product?.images?.[0]);
      return src ? { code, url: thumbnailUrl(src) } : null;
    })
    .filter((job): job is { code: string; url: string } => job !== null);

  const signal = AbortSignal.timeout(TOTAL_TIMEOUT_MS);
  let next = 0;
  const worker = async () => {
    while (next < jobs.length && !signal.aborted) {
      const job = jobs[next++]!;
      try {
        const bytes = await fetchJpeg(job.url, signal);
        if (bytes) photos.set(job.code, await doc.embedJpg(bytes));
      } catch {
        // Missing photo: the row renders without it.
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, jobs.length) }, worker));
  return photos;
}

/** Draws `photo` fitted and centred in the photo box whose top-left corner is (x, top). */
export function drawItemPhoto(page: PDFPage, photo: PDFImage, x: number, top: number) {
  const { width, height } = photo.scaleToFit(PDF_PHOTO_SIZE, PDF_PHOTO_SIZE);
  page.drawImage(photo, {
    x: x + (PDF_PHOTO_SIZE - width) / 2,
    y: top - PDF_PHOTO_SIZE + (PDF_PHOTO_SIZE - height) / 2,
    width,
    height,
  });
}

/**
 * Public thumbnail URL (white-backed JPEG) of each item code's storefront photo, for emails.
 * Codes without a usable photo are left out.
 */
export async function itemPhotoUrls(codes: string[], width = 120) {
  const urls = new Map<string, string>();
  const unique = [...new Set(codes.map((code) => code.trim()).filter(Boolean))].slice(0, MAX_PHOTOS);
  if (!unique.length) return urls;
  try {
    const products = await getFreshCheckoutProducts(unique);
    for (const code of unique) {
      const product = products.get(code);
      const src = photoSource(product?.imageUrl) ?? photoSource(product?.images?.[0]);
      if (src) urls.set(code, thumbnailUrl(src).replace(`w=${FETCH_WIDTH}&h=${FETCH_WIDTH}`, `w=${width}&h=${width}`));
    }
  } catch (err) {
    console.error("email item photos: catalog lookup failed", err);
  }
  return urls;
}
