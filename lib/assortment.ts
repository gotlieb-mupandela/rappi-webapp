import { formatPrice } from "@/lib/format";
import type { Product } from "@/lib/types";
import type { TFunction } from "@/lib/i18n/translate";

/**
 * Headwear (caps/hats/visors/beanies) and balls at/above these NAD sell
 * prices are treated as wholesale packs, not silent single pieces.
 * Pack size is unknown from the feed — do not divide into a unit price.
 */
export const WHOLESALE_HEADWEAR_THRESHOLD_NAD = 1000;
export const WHOLESALE_BALL_THRESHOLD_NAD = 1000;

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
  kind?: "named" | "multipack" | "wholesale" | "wholesale-pack" | "pack" | "assortment";
};

/** Explicit pack-policy flag values (see Product.sellAs). */
export type SellAs = "pack" | "assortment" | "multipack";

export const BIB_PACK_PRICE_NAD = 783;

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

const HEADWEAR_RE = /\b(caps?|hats?|visors?|beanies?)\b/i;
const HEADWEAR_NOT = /\bscrum\b/i;
const BALL_RE = /\b(balls?|bal[oó]n)\b/i;
const BALL_NOT = /\b(bag|backpack|pants)\b/i;

export function isHeadwearSku(product: Product) {
  if (product.subcategory === "caps") return true;
  if (HEADWEAR_NOT.test(blob(product))) return false;
  return HEADWEAR_RE.test(blob(product));
}

export function isBallSku(product: Product) {
  if (product.subcategory === "balls") return true;
  const text = blob(product);
  if (BALL_NOT.test(text)) return false;
  return BALL_RE.test(text);
}

/**
 * Headwear / balls at pack-looking prices: never render as silent singles.
 * No pack size is encoded in the feed, so packSize stays null and no
 * per-unit division is shown — do not invent 6/8/12 math here.
 */
export function isWholesaleHeadwearPack(product: Product) {
  if (!isHeadwearSku(product)) return false;
  const price = product.price || product.unitPrice || 0;
  return price >= WHOLESALE_HEADWEAR_THRESHOLD_NAD;
}

export function isWholesaleBallPack(product: Product) {
  if (!isBallSku(product)) return false;
  const price = product.price || product.unitPrice || 0;
  return price >= WHOLESALE_BALL_THRESHOLD_NAD;
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

/**
 * Explicit pack-policy flags from the catalog row (data/b2c-price-fix-data.json).
 * Checked before any name/price sniffing so listed packs always render as packs.
 * pairHint stays null: the supplier unit figure is never our selling price,
 * so no per-unit math is shown for these packs.
 */
function explicitPackInfo(product: Product): AssortmentInfo | null {
  const sellAs = product.sellAs;
  if (!sellAs) return null;
  const n = product.packSize ?? null;
  if (sellAs === "multipack") {
    return {
      isAssortment: true,
      packSize: n && n > 1 ? n : null,
      label: "Multipack",
      pairHint: null,
      kind: "multipack",
    };
  }
  if (sellAs === "assortment") {
    return {
      isAssortment: true,
      packSize: n && n > 1 ? n : null,
      label: "Assortment pack",
      pairHint: null,
      kind: "assortment",
    };
  }
  if (n && n > 1) {
    return {
      isAssortment: true,
      packSize: n,
      label: `Pack of ${n}`,
      pairHint: null,
      kind: "pack",
    };
  }
  return {
    isAssortment: true,
    packSize: null,
    label: "Pack",
    pairHint: null,
    kind: "pack",
  };
}

export function getAssortment(
  product: Product,
  format: (nad: number) => string = formatPrice,
): AssortmentInfo | null {
  const explicit = explicitPackInfo(product);
  if (explicit) return explicit;

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

  if (isWholesaleHeadwearPack(product) || isWholesaleBallPack(product)) {
    return {
      isAssortment: true,
      packSize: null,
      label: "Wholesale pack",
      pairHint: null,
      kind: "wholesale-pack",
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
  // Explicit pack-policy packs first: badge is exactly Pack / Assortment /
  // Multipack and no per-unit math is ever shown (supplier unit figures are
  // never our selling price). Must precede the generic packSize branch below,
  // which divides price by pack size for detected (non-explicit) packs.
  if (info.kind === "pack") {
    return {
      ...info,
      label: t("product.pack"),
      pairHint: null,
    };
  }
  if (info.kind === "assortment") {
    if (info.packSize && info.packSize > 1) {
      const unit = isFootwearSku(product) ? t("product.pairs") : t("product.pcs");
      return {
        ...info,
        label: t("product.assortmentNamed", { n: info.packSize, unit }),
        pairHint: null,
      };
    }
    return {
      ...info,
      label: t("product.assortment"),
      pairHint: null,
    };
  }
  if (info.kind === "multipack") {
    if (info.packSize && info.packSize > 1) {
      const unit = isFootwearSku(product) ? t("product.pairs") : t("product.pcs");
      return {
        ...info,
        label: t("product.multipackNamed", { n: info.packSize, unit }),
        pairHint: null,
      };
    }
    return {
      ...info,
      label: t("product.multipack"),
      pairHint: null,
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
  if (info.kind === "wholesale-pack") {
    return {
      ...info,
      label: t("product.wholesalePack"),
      pairHint: null,
    };
  }
  // No remaining kind reaches here: footwear/apparel price-threshold
  // heuristics were removed, so packs are only named, multipack,
  // wholesale-pack, or explicit sell_as metadata.
  return null;
}

/**
 * Localized pack title suffix for render (cards, PDP, search).
 * Bake stores neutral base names only — this adds the pack wording in the
 * shopper's locale: "· Pack of 12" / "· pack de 12", "· Assortment · 8 pairs",
 * "· Multipack", … Returns null when the product is not sold as a pack.
 */
export function packTitleSuffix(product: Product, t: TFunction): string | null {
  const info = getAssortment(product);
  if (!info) return null;
  if (info.packSize && info.packSize > 1) {
    if (info.kind === "assortment") {
      const unit = isFootwearSku(product) ? t("product.pairs") : t("product.pcs");
      return ` · ${t("product.assortmentNamed", { n: info.packSize, unit })}`;
    }
    if (info.kind === "multipack") {
      const unit = isFootwearSku(product) ? t("product.pairs") : t("product.pcs");
      return ` · ${t("product.multipackNamed", { n: info.packSize, unit })}`;
    }
    return ` · ${t("product.titlePackNamed", { n: info.packSize })}`;
  }
  if (info.kind === "multipack") return ` · ${t("product.multipack")}`;
  if (info.kind === "assortment") return ` · ${t("product.assortmentPack")}`;
  if (info.kind === "pack") return ` · ${t("product.pack")}`;
  return null;
}
