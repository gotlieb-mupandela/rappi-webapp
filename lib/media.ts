import extraGalleryByCode from "@/data/ai-gallery-urls.json";
import preTileImages from "@/data/pre-person-tile-images.json";
import { metaAbsoluteUrl, metaSiteUrl } from "@/lib/meta/site";
import type { Product } from "@/lib/types";

const STORAGE_ROOT = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/product-images`
  : "";

const EXTRA_GALLERY = extraGalleryByCode as Record<string, string[]>;

/** AI-generated renders (e.g. product-images/<code>/ai-02-back.webp) are never shown. */
export function isAiImage(url: string | undefined | null) {
  return Boolean(url && /\/ai-[^/]*$/i.test(url.split("?")[0]));
}

function isRemoteUrl(url: string | undefined | null) {
  return Boolean(url && /^https?:\/\//i.test(url) && !isAiImage(url));
}

/** Official Joma catalogue on-model photos hosted in `public/catalog-photos/`. */
export function isCatalogPhoto(url: string | undefined | null) {
  return Boolean(url && url.startsWith("/catalog-photos/"));
}

function isGalleryUrl(url: string | undefined | null) {
  return isRemoteUrl(url) || isCatalogPhoto(url);
}

/** True when the SKU has a real remote or brand-local photo (not a placeholder). */
export function hasUsableProductImage(product: {
  imageUrl?: string | null;
  images?: string[] | null;
}) {
  const urls = [product.imageUrl, ...(product.images ?? [])].filter(
    (url): url is string => Boolean(url),
  );
  return urls.some((url) => {
    if (/^https?:\/\//i.test(url)) return true;
    // Real local assets only — ignore invented `/products/{id}/…` placeholders
    // that 404 and used to surface silhouette fallbacks.
    if (url.startsWith("/products/")) return false;
    return url.startsWith("/");
  });
}

function extraGalleryUrls(product: { id: string; code?: string }) {
  const fromCode = product.code ? EXTRA_GALLERY[product.code] : undefined;
  const fromId = EXTRA_GALLERY[product.id];
  return [...(fromCode ?? []), ...(fromId ?? [])].filter(isRemoteUrl);
}

function mergeGallery(
  product: { id: string; code?: string },
  primary: string | undefined,
  images: string[],
  upgrade: boolean,
) {
  const extras = extraGalleryUrls(product);
  const mapped = [...images, ...extras]
    .filter(Boolean)
    .map((url) => (upgrade ? upgradeProductImageUrl(url) : url));
  const first = primary
    ? upgrade
      ? upgradeProductImageUrl(primary)
      : primary
    : mapped[0];
  const merged = [...new Set([...(first ? [first] : []), ...mapped])];
  if (first && merged[0] !== first) {
    return { imageUrl: first, images: [first, ...merged.filter((url) => url !== first)] };
  }
  return { imageUrl: first ?? "", images: merged };
}

function isDemandwareMedium(url: string) {
  return /\/images\/medium\//i.test(url);
}

function isJomaNet(url: string) {
  return /v1\.joma-sport\.net/i.test(url);
}

/**
 * Ordered card sources: first Demandware medium, then Joma.net primary (reliable
 * fallback), then remaining gallery URLs. Callers should walk this list on error.
 */
export function productCardImageCandidates(product: {
  imageUrl?: string | null;
  images?: string[] | null;
}): string[] {
  const gallery = (product.images ?? []).filter(Boolean);
  const primary = product.imageUrl?.trim() || "";
  const catalog = [primary, ...gallery].filter(isCatalogPhoto);
  const mediums = gallery.filter(isDemandwareMedium);
  const nets = [primary, ...gallery].filter(isJomaNet);
  const rest = [primary, ...gallery].filter(
    (url) => url && !isDemandwareMedium(url) && !isJomaNet(url) && !isCatalogPhoto(url),
  );
  return [
    ...new Set(
      [catalog[0], mediums[0], nets[0], ...mediums.slice(1), ...nets.slice(1), ...rest].filter(
        Boolean,
      ),
    ),
  ];
}

/**
 * Prefer the medium gallery shot for cards, then the supplier CDN primary.
 */
const ALLOWED_REMOTE_IMAGES = [
  { host: "wsrv.nl", pathnamePrefix: "/" },
  {
    host: "wzmzwerzbyudcvoiiege.supabase.co",
    pathnamePrefix: "/storage/v1/object/public/product-images/",
  },
  { host: "www.joma-sport.com", pathnamePrefix: "/on/demandware.static/" },
  { host: "v1.joma-sport.net", pathnamePrefix: "/files/" },
] as const;

/** Public origin from `NEXT_PUBLIC_SITE_URL`, never the request Host header. */
function canonicalSiteHost() {
  try {
    return new URL(metaSiteUrl()).hostname;
  } catch {
    return "";
  }
}

/**
 * Same hosts as `images.remotePatterns` in next.config.ts, plus a same-origin
 * path. An absolute URL on the canonical site origin is allowed because that
 * is the public file those relative paths already pointed at.
 */
export function isAllowedProductImageUrl(url: string) {
  if (!url || url.startsWith("//")) return false;
  if (url.startsWith("/")) return true;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:") return false;
  if (parsed.hostname === canonicalSiteHost()) return true;
  return ALLOWED_REMOTE_IMAGES.some(
    (rule) => parsed.hostname === rule.host && parsed.pathname.startsWith(rule.pathnamePrefix),
  );
}

/**
 * Absolute https form of one image URL. Relative paths are resolved with
 * `metaAbsoluteUrl` (the canonical site origin). http and hosts outside
 * the allow list are dropped.
 */
function absoluteAllowedImageUrl(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed || trimmed.startsWith("//") || /^http:\/\//i.test(trimmed)) return null;
  const absolute = /^https:\/\//i.test(trimmed)
    ? trimmed
    : trimmed.startsWith("/")
      ? metaAbsoluteUrl(trimmed)
      : null;
  if (!absolute || !/^https:\/\//i.test(absolute)) return null;
  return isAllowedProductImageUrl(absolute) ? absolute : null;
}

/** First card candidate as an absolute https URL, or null when it is not allowed. */
export function cardImageUrl(product: {
  imageUrl?: string | null;
  images?: string[] | null;
}): string | null {
  const first = productCardImageCandidates(product)[0] ?? "";
  return first ? absoluteAllowedImageUrl(first) : null;
}

export function productCardImageUrl(product: {
  imageUrl?: string | null;
  images?: string[] | null;
}) {
  return cardImageUrl(product) ?? "";
}

/**
 * Joma `_large.jpg` thumbs are ~30KB; the same path without `_large` is full-res.
 * Catalog bake strips `_large`; PDP still upgrades defensively.
 */
export function upgradeProductImageUrl(url: string) {
  return url.replace(/_large(?=\.(jpe?g|png|webp)(\?|$))/i, "");
}

export function productPublicUrls(id: string) {
  const images = [1, 2, 3, 4, 5].map(
    (n) => `/products/${id}/${String(n).padStart(2, "0")}.webp`,
  );
  return { imageUrl: images[0], images };
}

export function productStorageUrls(id: string) {
  const root = `${STORAGE_ROOT}/${id}`;
  const images = [1, 2, 3, 4, 5].map(
    (n) => `${root}/${String(n).padStart(2, "0")}.webp`,
  );
  return { imageUrl: images[0], images };
}

/** Prefer real CDN/remote URLs already on the product; keep `_large` thumbs for listings. */
export function withProductImages<
  T extends { id: string; imageUrl: string; images: string[]; code?: string },
>(product: T): T {
  if (isRemoteUrl(product.imageUrl) || product.images?.some(isRemoteUrl)) {
    const remoteImages = (product.images ?? []).filter(isGalleryUrl);
    const remotePrimary =
      remoteImages.find(isCatalogPhoto) ??
      (isRemoteUrl(product.imageUrl) ? product.imageUrl : remoteImages[0]);

    if (remotePrimary) {
      return {
        ...product,
        ...mergeGallery(
          product,
          remotePrimary,
          remoteImages.length ? remoteImages : [remotePrimary],
          false,
        ),
      };
    }
  }

  if (product.imageUrl?.startsWith("/") && !product.imageUrl.startsWith("/products/")) {
    const localImages = (product.images ?? []).filter((url) => url.startsWith("/"));
    return {
      ...product,
      imageUrl: product.imageUrl,
      images: localImages.length ? localImages : [product.imageUrl],
    };
  }

  // No remote CDN shot and no real local asset — leave empty rather than inventing
  // `/products/{id}/01.webp` paths that 404 into silhouette placeholders.
  return {
    ...product,
    imageUrl: "",
    images: [],
  };
}

/** Full-resolution gallery for PDP — strips Joma `_large` thumb suffix. */
export function withFullResProductImages<T extends Product>(product: T): T {
  return {
    ...product,
    imageUrl: product.imageUrl ? upgradeProductImageUrl(product.imageUrl) : product.imageUrl,
    images: (product.images ?? []).map(upgradeProductImageUrl),
  };
}

/**
 * Card frame each product had before galleries were re-led with a person
 * (PR #46). Folder, hub and landing tiles use these: a tile stands for a
 * whole folder or audience, and a shared teamwear code's model is usually an
 * adult man, which is wrong on Kids and Woman tiles. Product pages and cards
 * keep the person lead.
 */

const PRE_TILE_IMAGES = preTileImages as Record<string, string>;

export function tileImageCandidates(product: {
  code?: string | null;
  imageUrl?: string | null;
  images?: string[] | null;
}): string[] {
  // Tiles keep the product-only frame: catalogue model shots are adults.
  const base = productCardImageCandidates(product).filter((url) => !isCatalogPhoto(url));
  const pre = product.code ? PRE_TILE_IMAGES[product.code] : "";
  return pre ? [...new Set([pre, ...base])] : base;
}

export function tileImageUrl(product: {
  code?: string | null;
  imageUrl?: string | null;
  images?: string[] | null;
}) {
  return tileImageCandidates(product)[0] ?? "";
}

/**
 * Card frames for a listing scoped to one audience. A shared teamwear code's
 * person lead is usually an adult man, so Kids listings (non 5/6xxxxx codes)
 * and Woman listings (non 9xxxxx codes) use the earlier product-only frame.
 */
export function listingCardCandidates(
  product: { code?: string | null; imageUrl?: string | null; images?: string[] | null },
  audience?: string | null,
): string[] {
  const code = product.code ?? "";
  if (audience === "kids" && !/^[56]\d{5}\./.test(code)) return tileImageCandidates(product);
  if (audience === "women" && !/^9\d{5}\./.test(code)) return tileImageCandidates(product);
  const urls = productCardImageCandidates(product);
  const primary = cardImageUrl(product);
  // A relative catalogue photo resolves to the same file. Keep the site path
  // on the card; the API field is the absolute form from cardImageUrl.
  if (!primary || absoluteAllowedImageUrl(urls[0] ?? "") === primary) return urls;
  return [primary, ...urls.filter((url) => absoluteAllowedImageUrl(url) !== primary)];
}
