import extraGalleryByCode from "@/data/ai-gallery-urls.json";
import type { Product } from "@/lib/types";

const STORAGE_ROOT = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/product-images`
  : "";

const EXTRA_GALLERY = extraGalleryByCode as Record<string, string[]>;

function isRemoteUrl(url: string | undefined | null) {
  return Boolean(url && /^https?:\/\//i.test(url));
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

/**
 * Prefer Demandware `medium` gallery shots for cards (~small CDN thumbs).
 * Falls back to primary imageUrl. Preserves any leftover `_large` thumbs.
 */
export function productCardImageUrl(product: {
  imageUrl?: string | null;
  images?: string[] | null;
}) {
  const medium = (product.images ?? []).find((url) =>
    /\/images\/medium\//i.test(url),
  );
  if (medium) return medium;
  return product.imageUrl ?? "";
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
    const remoteImages = (product.images ?? []).filter(isRemoteUrl);
    const remotePrimary = isRemoteUrl(product.imageUrl)
      ? product.imageUrl
      : remoteImages[0];

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
