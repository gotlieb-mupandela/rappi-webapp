/**
 * Folder and homepage tile pins. `lib/tile-covers.ts` is the site lookup.
 * This file holds only the codes so the feed can resolve the same pins
 * without loading the offline catalog module.
 */
export const TILE_PRODUCT_CODES: Record<string, string> = {
  "home:lifestyle": "100818.200",
  "home:kids": "500828.345",
  "home:running": "104129.100",

  teamwear: "104594.102",
  "running-trail-woman": "104129.100",
  "fitness-gym-woman": "102968.008",
  "lifestyle-apparel-woman": "104736.324",
  "racket-sports-woman": "103538.837",
  "underwear-brama-woman": "101015.200",
  beachwear: "105382.585",

  "kids-1-4": "600157.600",
  "kids-6-10": "500948.200",
  "kids-12-14-boy": "500947.003",
  "kids-12-14-girl": "500951.594",

  "padel-shoes": "TSLAMS2601OM",
  "se-padel": "TSLAMS2601OM",
  pickleball: "PSTROLS2602C",
  "hockey-shoes": "HPULW2602",
  "joma-flow": "CJFZENS2723",
  "handball-shoes": "104913.102",
  "basketball-shoes": "101660.100",
  "footwear-outlet": "FSS2402IN",

  "acc-medias": "400022.100",
  "acc-tiendas": "JOM-019",
  "acc-outdoor": "401970.477",
  "acc-teamwear": "400024.100",
  "acc-racket": "401845.100",
  "acc-backpacks": "400001.450",

  resort: "104657.100",
  "w-resort": "902748.649",
};

/** Used only when the folder itself has no photographed product. */
export const EMPTY_FOLDER_CODES: Record<string, string> = {
  "hiking-outdoor": "104477.004",
  "athletes-combat": "104413.200",
};

/** Gallery file for a pin. Empty when the pin uses the card image. */
export const TILE_GALLERY_FILE: Record<string, string> = {
  "home:kids": "500828.345_2.jpg",
  "underwear-brama-woman": "101015.200_1.jpg",
  "basketball-shoes": "101660.100_1.jpg",
  "lifestyle-apparel-woman": "20250829135121.104736.324.jpg",
};
