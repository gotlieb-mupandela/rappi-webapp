import { tileImageUrl } from "@/lib/media";

export type TileFit = "cover" | "contain";

/**
 * How a picture is cropped. fit and objectPosition are the CSS the site applies.
 * imagePosition is the Tailwind class HubTile receives for that same crop.
 */
export type TileFrame = {
  fit: TileFit;
  objectPosition: string;
  imagePosition: string;
};

/** Listing card. components/product-card.tsx uses this class on the photo. */
export const PRODUCT_CARD_FRAME: TileFrame = {
  fit: "contain",
  objectPosition: "center",
  imagePosition: "object-center",
};

/** Shop-by-type folder tile. components/folder-grid.tsx. */
export const FOLDER_TILE_FRAME: TileFrame = {
  fit: "cover",
  objectPosition: "center",
  imagePosition: "object-center",
};

/**
 * Shop-by-athlete tile on a category page.
 * A brand cover is contained. A product photo (Kids) is cropped from the centre.
 * app/category/[slug]/page.tsx passes the same fit into HubTile.
 */
export function audienceTileFrame(hasCover: boolean): TileFrame {
  return hasCover
    ? { fit: "contain", objectPosition: "center", imagePosition: "object-center" }
    : { fit: "cover", objectPosition: "center", imagePosition: "object-center" };
}

/**
 * Primary picture HubTile shows: the cover when the tile has one, otherwise
 * the sample product's tile photo (tileImageUrl).
 */
export function audienceTileImage(
  cover: string | undefined,
  sample: { code?: string | null; imageUrl?: string | null; images?: string[] | null } | null | undefined,
): string {
  if (cover) return cover;
  if (!sample) return "";
  return tileImageUrl(sample);
}
