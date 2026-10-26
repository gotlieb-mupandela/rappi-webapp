import { hasUsableProductImage } from "@/lib/media";
import type { Product } from "@/lib/types";

type Gallery = Pick<Product, "imageUrl" | "images">;

/**
 * Gallery for one live listing row.
 *
 * A code that exists in the baked catalog keeps that file's imageUrl and
 * images, so the API matches the product page. Price, stock, sizes and text
 * stay on the live row. A code that exists only on the live row keeps that
 * row's images. hasImage is computed from the gallery that was used.
 */
export function withBakedGallery<T extends Gallery>(
  live: T,
  baked?: Gallery,
): T & { hasImage: boolean } {
  const imageUrl = baked ? baked.imageUrl : live.imageUrl;
  const images = [...(baked ? baked.images : live.images)];
  const next = { ...live, imageUrl, images };
  return { ...next, hasImage: hasUsableProductImage(next) };
}
