/**
 * Server-side image helpers. Same API as lib/media-core.ts, but tile helpers
 * look up the pre-person tile frame in data/pre-person-tile-images.json when
 * the product does not already carry `tileImage`. Client components import
 * lib/media-core.ts so that file is not shipped to the browser.
 */
import preTileImages from "@/data/pre-person-tile-images.json";
import {
  listingCardCandidates as coreListingCardCandidates,
  tileImageCandidates as coreTileImageCandidates,
  type TileImageSource,
} from "@/lib/media-core";

export * from "@/lib/media-core";

const PRE_TILE_IMAGES = preTileImages as Record<string, string>;

/** Pre-person tile frame for a product code, or null. */
export function preTileImage(code: string | null | undefined): string | null {
  return (code && PRE_TILE_IMAGES[code]) || null;
}

function withTileImage<T extends TileImageSource>(product: T): T {
  if (product.tileImage !== undefined) return product;
  return { ...product, tileImage: preTileImage(product.code) };
}

export function tileImageCandidates(product: TileImageSource): string[] {
  return coreTileImageCandidates(withTileImage(product));
}

export function tileImageUrl(product: TileImageSource) {
  return tileImageCandidates(product)[0] ?? "";
}

export function listingCardCandidates(product: TileImageSource, audience?: string | null): string[] {
  return coreListingCardCandidates(withTileImage(product), audience);
}
