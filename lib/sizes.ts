import source from "@/data/products-source.json";
import sizeMaster from "@/data/size-master.json";
import { getAssortment } from "@/lib/assortment";
import type { Product, SizeStock } from "@/lib/types";

export {
  buyableSizes,
  hasVisibleSizePicker,
  isSoldOut,
  pickerSizes,
  sizeDisplayLabel,
  sizeStock,
  skuStock,
  stockLabel,
} from "@/lib/product-stock";

import { skuStock } from "@/lib/product-stock";

type SourceRow = { code: string; sizes?: string | null; qty?: number };
type MasterRow = {
  sizes: string[];
  qty?: number;
  /** Per-size counts only when the feed provided them. Never invented. */
  perSize?: Record<string, number> | null;
};

const SOURCE_BY_CODE = new Map(
  (source as SourceRow[]).map((row) => [row.code, row]),
);
const MASTER_BY_CODE = new Map(
  Object.entries(sizeMaster as Record<string, MasterRow>),
);

const TRUE_ONE_SIZE_SUBS = new Set([
  "bags",
  "balls",
  "rackets",
  "caps",
  "goggles",
  "mats",
  "towels",
]);

function parseSizeList(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const upper = String(raw).trim();
  if (!upper || /^one(?:\s*size)?$/i.test(upper)) return ["ONE"];
  return upper
    .split(/[\/|,]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function isTrueOneSize(product: Product) {
  if (TRUE_ONE_SIZE_SUBS.has(product.subcategory)) return true;
  const blob = `${product.displayName} ${product.item} ${product.sheetCategory}`.toLowerCase();
  return /\b(one size|trolley|first aid|gps bib)\b/.test(blob);
}

function hasRecordedSizeRun(product: Product) {
  const opts = product.sizeOptions ?? [];
  if (opts.length === 0) return false;
  if (opts.length === 1 && /^(ONE|SKU|PACK)$/i.test(opts[0])) return false;
  return true;
}

function rowsFromSizes(
  sizes: string[],
  total: number,
  perSize?: Record<string, number> | null,
): SizeStock[] {
  return sizes.map((size) => {
    if (perSize && Object.prototype.hasOwnProperty.call(perSize, size)) {
      const n = Number(perSize[size]);
      return { size, stock: Number.isFinite(n) ? Math.max(0, n) : 0 };
    }
    // Size exists on the master; per-size qty is unknown. Availability follows SKU stock.
    return { size, stock: total > 0 ? total : 0 };
  });
}

/**
 * Attach only sizes that exist on a catalog master.
 * Does not invent apparel/shoe charts. Placeholder `ONE` on clothing/footwear
 * is not treated as a real size.
 */
export function withCatalogSizes<T extends Product>(product: T): T {
  const master = MASTER_BY_CODE.get(product.code);
  const sheet = SOURCE_BY_CODE.get(product.code);
  const recorded = hasRecordedSizeRun(product);
  const overlayQty = master?.qty ?? sheet?.qty;
  const total = skuStock({
    stockQty: overlayQty ?? product.stockQty,
    totalQty: product.totalQty,
  });

  if (master?.sizes?.length) {
    const rows = rowsFromSizes(master.sizes, total, master.perSize);
    return {
      ...product,
      sizeOptions: rows.map((r) => r.size),
      sizes: rows,
      stockQty: total,
      totalQty: total,
    };
  }

  const fromSheet = parseSizeList(sheet?.sizes);
  if (fromSheet.length && !(fromSheet.length === 1 && fromSheet[0] === "ONE" && !isTrueOneSize(product))) {
    const rows = rowsFromSizes(fromSheet, total);
    return {
      ...product,
      sizeOptions: rows.map((r) => r.size),
      sizes: rows,
      stockQty: total,
      totalQty: total,
    };
  }

  if (recorded) {
    const rows = (product.sizes?.length ? product.sizes : product.sizeOptions.map((size) => ({ size, stock: total })))
      .map((row) => ({ size: row.size, stock: row.stock > 0 && total > 0 ? row.stock : 0 }));
    return { ...product, sizes: rows, stockQty: total, totalQty: total };
  }

  const assortment = getAssortment(product);
  if (assortment?.isAssortment && !assortment.preserveSizes) {
    return {
      ...product,
      sizeOptions: ["PACK"],
      sizes: [{ size: "PACK", stock: total }],
      stockQty: total,
      totalQty: total,
    };
  }

  if (isTrueOneSize(product)) {
    return {
      ...product,
      sizeOptions: ["ONE"],
      sizes: [{ size: "ONE", stock: total }],
      stockQty: total,
      totalQty: total,
    };
  }

  // Clothing/footwear with no size master: sell as a SKU, do not show a fake ONE size.
  return {
    ...product,
    sizeOptions: ["SKU"],
    sizes: [{ size: "SKU", stock: total }],
    stockQty: total,
    totalQty: total,
  };
}
