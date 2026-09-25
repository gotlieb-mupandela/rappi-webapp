import { formatPrice } from "@/lib/format";
import type { Product } from "@/lib/types";
import type { TFunction } from "@/lib/i18n/translate";

/**
 * Wholesale footwear in this band is sold as mixed-size assortment boxes
 * (typically 8 or 12 pairs). The price feed does not encode pack size —
 * `unitPrice` equals the sell / pack price. Do not invent a single-pair list price.
 */
export const WHOLESALE_SHOE_ASSORTMENT_THRESHOLD_NAD = 4000;

/**
 * Apparel sold on the Joma clothing size grid (S01–S11) at/above this NAD
 * sell price is treated as a wholesale assortment box (shirts, shorts, etc.),
 * not a single piece — even when the name omits "PACK".
 */
export const WHOLESALE_APPAREL_ASSORTMENT_THRESHOLD_NAD = 700;

/** Joma apparel size codes (not footwear EU sizes like S25/S28). */
const CLOTHING_SIZE = /^S0[1-9]$|^S1[01]$/i;

const APPAREL_SUBS = new Set([
  "tees",
  "tees-kids",
  "polos",
  "pants",
  "shorts",
  "jackets",
  "hoodies",
  "tops",
  "bras",
  "underwear",
  "skins",
  "skirts",
  "dresses",
  "tracksuits",
  "swimwear",
  "tights",
  "leggings",
  "jerseys",
  "sets",
]);

const APPAREL_NAME =
  /\b(shirt|t-shirts?|tees?|polo|short|bermuda|pant|trouser|jacket|anorak|hoodie|sweatshirt|sweat|top|tank|bra|brief|briefs|boxer|boxers|underwear|slip|skirt|dress|tight|legging|jersey|tracksuit)\b/i;

const NAMED_PACK = /\bpack(?:\s+of)?\s+(\d+)\b/i;
const BOX_OF = /\bbox of\s+(\d+)\b/i;
const MULTIPACK_RE = /\bmultipack\b/i;
const EVENTOS_PACK_CODE = /^105463\./i;
const EVENTOS_NAME_RE = /\beventos\b/i;
const EVENTOS_TEE_RE = /\b(t-?shirts?|tees?)\b/i;
const NOT_EVENTOS_PACK_RE = /\b(sack|bag|backpack)\b/i;

export const EVENTOS_TEE_PACK_SIZE = 25;
export const EVENTOS_TEE_PACK_THRESHOLD_NAD = 2000;

const FOOTWEAR_NAME =
  /\b(sneaker|sandal|barefoot|shoe|boot|cleat|spike|trainer|footwear)\b/i;
const NOT_FOOTWEAR =
  /\b(shoe bag|bag|backpack|shirt|t-shirt|short|bermuda|jacket|sweat|pant|tight|legging|bra|sock|dress|skirt|glove|cap|hat)\b/i;
const FOOTBALL_SURFACE =
  /\b(turf|firm ground|soft ground|artificial grass|futsal|indoor)\b/i;

export type AssortmentInfo = {
  isAssortment: boolean;
  /** Exact count when the name/sheet encodes it; otherwise null. */
  packSize: number | null;
  label: string;
  pairHint: string | null;
  /** Keep the Joma size run (e.g. bib S01–S04) instead of collapsing to PACK. */
  preserveSizes?: boolean;
  kind?: "named" | "multipack" | "wholesale";
};

export const BIB_PACK_PRICE_NAD = 900;

const BIB_CODE = /^101686\./i;
const TRAINING_BIB_RE = /\b(training bibs?|petos(?:\s+de\s+entrenamiento|\s+entrenamiento)?)\b/i;
const NOT_BIB_PACK_RE = /\b(gps bib|crono bib|myskin)\b/i;

export function isTrainingBibPack(product: Product) {
  if (BIB_CODE.test(product.code)) return true;
  const text = blob(product);
  if (!TRAINING_BIB_RE.test(text) || NOT_BIB_PACK_RE.test(text)) return false;
  return (product.sizeOptions ?? []).some((s) => /^S0\d$/i.test(s));
}

export function isFixedBibPack(product: Product) {
  return BIB_CODE.test(product.code);
}

function blob(product: Product) {
  return [product.displayName, product.name, product.title, product.item, product.sheetCategory]
    .filter(Boolean)
    .join(" ");
}

export function isFootwearSku(product: Product) {
  if (product.category === "shoes") return true;
  if (product.subcategory === "boots" || product.subcategory === "kids-shoes") return true;
  const text = blob(product);
  if (NOT_FOOTWEAR.test(text) && !FOOTWEAR_NAME.test(text)) return false;
  if (FOOTWEAR_NAME.test(text)) return true;
  if (product.category === "football" && FOOTBALL_SURFACE.test(text)) return true;
  return false;
}

export function isApparelSku(product: Product) {
  if (isFootwearSku(product)) return false;
  if (APPAREL_SUBS.has(product.subcategory)) return true;
  return APPAREL_NAME.test(blob(product));
}

/** True when every size is on the Joma clothing grid S01–S11. */
export function hasClothingSizeGrid(product: Product) {
  const sizes = product.sizeOptions ?? [];
  return sizes.length > 0 && sizes.every((s) => CLOTHING_SIZE.test(s));
}

function namedPackSize(product: Product): number | null {
  const text = blob(product);
  const pack = text.match(NAMED_PACK);
  if (pack) return Number(pack[1]);
  const box = text.match(BOX_OF);
  if (box) return Number(box[1]);
  return null;
}

export function isEventosTeePack(product: Product) {
  if (EVENTOS_PACK_CODE.test(product.code)) return true;
  const text = blob(product);
  if (!EVENTOS_NAME_RE.test(text) || !EVENTOS_TEE_RE.test(text)) return false;
  if (NOT_EVENTOS_PACK_RE.test(text)) return false;
  const price = product.price || product.unitPrice || 0;
  return price >= EVENTOS_TEE_PACK_THRESHOLD_NAD;
}

export function isMultipack(product: Product) {
  return MULTIPACK_RE.test(blob(product));
}

/**
 * Unlabeled apparel assortment boxes: clothing-grid sizes + elevated pack price.
 * Covers shirts, shorts, skirts, tracksuits, etc. — not footwear.
 */
export function isWholesaleApparelAssortment(product: Product) {
  if (!isApparelSku(product)) return false;
  if (!hasClothingSizeGrid(product)) return false;
  const price = product.price || product.unitPrice || 0;
  return price >= WHOLESALE_APPAREL_ASSORTMENT_THRESHOLD_NAD;
}

function namedPackInfo(
  product: Product,
  packSize: number,
  format: (nad: number) => string,
): AssortmentInfo {
  const footwear = isFootwearSku(product);
  const unit = footwear ? "pairs" : "pcs";
  const price = product.price || product.unitPrice || 0;
  return {
    isAssortment: true,
    packSize,
    label: `Pack · ${packSize} ${unit}`,
    pairHint: footwear
      ? pairHint(price, packSize, format)
      : price > 0
        ? `About ${format(price / packSize)} each`
        : null,
    kind: "named",
  };
}

function pairHint(price: number, size: number | null, format = formatPrice) {
  if (!price || price <= 0) return null;
  if (size && size > 1) {
    return `About ${format(price / size)} / pair`;
  }
  return `About ${format(price / 8)} / pair (8) · ${format(price / 12)} / pair (12)`;
}

function pieceHint(price: number, format = formatPrice) {
  if (!price || price <= 0) return null;
  return `About ${format(price / 6)} each (6) · ${format(price / 8)} each (8) · ${format(price / 12)} each (12)`;
}

export function getAssortment(
  product: Product,
  format: (nad: number) => string = formatPrice,
): AssortmentInfo | null {
  if (isTrainingBibPack(product)) {
    const price = product.price || product.unitPrice || BIB_PACK_PRICE_NAD;
    return {
      isAssortment: true,
      packSize: 10,
      label: "Pack of 10",
      pairHint: `${format(price / 10)} each`,
      preserveSizes: true,
    };
  }

  const named = namedPackSize(product);
  if (named && named > 1) {
    return namedPackInfo(product, named, format);
  }

  if (isEventosTeePack(product)) {
    return namedPackInfo(product, EVENTOS_TEE_PACK_SIZE, format);
  }

  if (isMultipack(product)) {
    return {
      isAssortment: true,
      packSize: null,
      label: "Multipack",
      pairHint: null,
      kind: "multipack",
    };
  }

  const price = product.price || product.unitPrice || 0;
  if (isFootwearSku(product) && price >= WHOLESALE_SHOE_ASSORTMENT_THRESHOLD_NAD) {
    return {
      isAssortment: true,
      packSize: null,
      label: "Wholesale assortment (8–12 pairs)",
      pairHint: pairHint(price, null, format),
      kind: "wholesale",
    };
  }

  if (isWholesaleApparelAssortment(product)) {
    return {
      isAssortment: true,
      packSize: null,
      label: "Wholesale assortment",
      pairHint: pieceHint(price, format),
      kind: "wholesale",
      // Keep S0x so shoppers still pick the packed size run when present.
      preserveSizes: true,
    };
  }

  return null;
}

export function assortmentCopy(
  product: Product,
  t: TFunction,
  format: (nad: number) => string,
) {
  const info = getAssortment(product, format);
  if (!info) return null;
  if (info.packSize === 10 && info.preserveSizes && isTrainingBibPack(product)) {
    return {
      ...info,
      label: t("product.packOf10"),
      pairHint: t("product.aboutEach", { amount: format((product.price || product.unitPrice || 0) / 10) }),
    };
  }
  if (info.packSize && info.packSize > 1) {
    const footwear = isFootwearSku(product);
    const unit = footwear ? t("product.pairs") : t("product.pcs");
    const price = product.price || product.unitPrice || 0;
    return {
      ...info,
      label: t("product.packNamed", { n: info.packSize, unit }),
      pairHint: footwear
        ? t("product.aboutPair", { amount: format(price / info.packSize) })
        : t("product.aboutEach", { amount: format(price / info.packSize) }),
    };
  }
  if (info.kind === "multipack") {
    return {
      ...info,
      label: t("product.multipack"),
      pairHint: null,
    };
  }
  const price = product.price || product.unitPrice || 0;
  if (isFootwearSku(product)) {
    return {
      ...info,
      label: t("product.wholesale"),
      pairHint: t("product.aboutPairRange", {
        eight: format(price / 8),
        twelve: format(price / 12),
      }),
    };
  }
  return {
    ...info,
    label: t("product.wholesaleApparel"),
    pairHint: t("product.aboutEachRange", {
      six: format(price / 6),
      eight: format(price / 8),
      twelve: format(price / 12),
    }),
  };
}
