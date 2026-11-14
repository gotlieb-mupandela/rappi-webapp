import type { TileFit } from "@/lib/tile-frame";

/**
 * Home bento layout shared by the site tiles and the mobile feed.
 * span, tone, fit and objectPosition are the feed fields.
 * className is the site class for that same tile.
 * imagePosition is the Tailwind class components/home-hero.tsx passes to HubTile.
 * objectPosition is the CSS that class computes (object-top is top, object-[center_20%] is center 20%).
 */

export const HOME_TILE_SPANS = [1, 2] as const;
export type HomeTileSpan = (typeof HOME_TILE_SPANS)[number];

export const HOME_TILE_TONES = ["dark", "light"] as const;
export type HomeTileTone = (typeof HOME_TILE_TONES)[number];

export type HomeTileLayout = {
  id: string;
  span: HomeTileSpan;
  tone: HomeTileTone;
  className: string;
  fit: TileFit;
  objectPosition: string;
  imagePosition: string;
};

export const HOME_TILE_LAYOUT: readonly HomeTileLayout[] = [
  {
    id: "teamwear",
    span: 2,
    tone: "dark",
    className: "col-span-2 min-h-[12rem] md:min-h-0",
    fit: "cover",
    objectPosition: "center",
    imagePosition: "object-center",
  },
  {
    id: "sportswear",
    span: 1,
    tone: "dark",
    className: "min-h-[12rem] md:min-h-0",
    fit: "cover",
    objectPosition: "top",
    imagePosition: "object-top",
  },
  {
    id: "running",
    span: 1,
    tone: "dark",
    className: "min-h-[12rem] md:min-h-0",
    fit: "cover",
    objectPosition: "center 20%",
    imagePosition: "object-[center_20%]",
  },
  {
    id: "lifestyle",
    span: 1,
    tone: "dark",
    className: "min-h-[12rem] md:min-h-0",
    fit: "cover",
    objectPosition: "center",
    imagePosition: "object-center",
  },
  {
    id: "footwear",
    span: 1,
    tone: "dark",
    className: "min-h-[12rem] md:min-h-0",
    fit: "cover",
    objectPosition: "center",
    imagePosition: "object-center",
  },
  {
    id: "kids",
    span: 2,
    tone: "light",
    className: "col-span-2 min-h-[12rem] md:min-h-0",
    fit: "cover",
    objectPosition: "center",
    imagePosition: "object-center",
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
