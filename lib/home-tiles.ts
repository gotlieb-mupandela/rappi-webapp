/**
 * Home bento layout shared by the site tiles and the mobile feed.
 * span and tone are the feed fields. className is the site class for that same tile.
 */

export const HOME_TILE_SPANS = [1, 2] as const;
export type HomeTileSpan = (typeof HOME_TILE_SPANS)[number];

export const HOME_TILE_TONES = ["dark", "light"] as const;
export type HomeTileTone = (typeof HOME_TILE_TONES)[number];

/**
 * Same crop the home bento uses. `top` is object-position top.
 * `center 20%` is object-position center 20% (about a fifth of the way down).
 */
export const HOME_TILE_IMAGE_POSITIONS = ["center", "top", "center 20%"] as const;
export type HomeTileImagePosition = (typeof HOME_TILE_IMAGE_POSITIONS)[number];

export type HomeTileLayout = {
  id: string;
  span: HomeTileSpan;
  tone: HomeTileTone;
  imagePosition: HomeTileImagePosition;
  /** Tailwind object-position class for this crop. */
  imageClassName: string;
  className: string;
};

export const HOME_TILE_LAYOUT: readonly HomeTileLayout[] = [
  {
    id: "teamwear",
    span: 2,
    tone: "dark",
    imagePosition: "center",
    imageClassName: "object-center",
    className: "col-span-2 min-h-[12rem] md:min-h-0",
  },
  {
    id: "sportswear",
    span: 1,
    tone: "dark",
    imagePosition: "top",
    imageClassName: "object-top",
    className: "min-h-[12rem] md:min-h-0",
  },
  {
    id: "running",
    span: 1,
    tone: "dark",
    imagePosition: "center 20%",
    imageClassName: "object-[center_20%]",
    className: "min-h-[12rem] md:min-h-0",
  },
  {
    id: "lifestyle",
    span: 1,
    tone: "dark",
    imagePosition: "center",
    imageClassName: "object-center",
    className: "min-h-[12rem] md:min-h-0",
  },
  {
    id: "footwear",
    span: 1,
    tone: "dark",
    imagePosition: "center",
    imageClassName: "object-center",
    className: "min-h-[12rem] md:min-h-0",
  },
  {
    id: "kids",
    span: 2,
    tone: "light",
    imagePosition: "center",
    imageClassName: "object-center",
    className: "col-span-2 min-h-[12rem] md:min-h-0",
  },
];

export function homeTileLayout(id: string): HomeTileLayout {
  const layout = HOME_TILE_LAYOUT.find((tile) => tile.id === id);
  if (!layout) throw new Error(`Home tile ${id} has no layout`);
  return layout;
}

/** Null when the value is outside the home span enum. */
export function asHomeSpan(value: number): HomeTileSpan | null {
  return value === 1 || value === 2 ? value : null;
}

/** Null when the value is outside the home tone enum. */
export function asHomeTone(value: string): HomeTileTone | null {
  return value === "dark" || value === "light" ? value : null;
}

/** Null when the value is outside the home crop enum. */
export function asHomeImagePosition(value: string): HomeTileImagePosition | null {
  return value === "center" || value === "top" || value === "center 20%" ? value : null;
}
