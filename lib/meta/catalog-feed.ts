import "server-only";

import { CATEGORIES, SUBCATEGORY_LABELS } from "@/lib/catalog";
import { productDescription } from "@/lib/copy";
import { feedGroupId, feedVariantId } from "@/lib/meta/ids";
import { metaAbsoluteUrl, metaSiteUrl } from "@/lib/meta/site";
import { getCatalog } from "@/lib/supabase/catalog";
import type { Product } from "@/lib/types";
import { productPath } from "@/lib/utils";
const FEED_COLUMNS = [
  "id",
  "item_group_id",
  "title",
  "description",
  "availability",
  "condition",
  "price",
  "link",
  "image_link",
  "additional_image_link",
  "brand",
  "product_type",
  "google_product_category",
  "additional_variant_attribute",
] as const;

const GOOGLE_CATEGORY: Record<string, string> = {
  sportswear: "Apparel & Accessories > Clothing > Activewear",
  shoes: "Apparel & Accessories > Shoes",
  lifestyle: "Apparel & Accessories > Shoes",
  football: "Sporting Goods > Team Sports > Soccer",
  rugby: "Sporting Goods > Team Sports > Rugby",
  basketball: "Sporting Goods > Team Sports > Basketball",
  hockey: "Sporting Goods > Team Sports > Hockey",
  cricket: "Sporting Goods > Team Sports > Cricket",
  swimming: "Sporting Goods > Outdoor Recreation > Boating & Water Sports > Swimming",
  padel: "Sporting Goods > Racket Sports",
  "running-fitness": "Apparel & Accessories > Clothing > Activewear",
  "balls-bags": "Sporting Goods > Outdoor Recreation",
  "teampro-2026": "Apparel & Accessories > Clothing > Activewear",
};

function tsvCell(value: string) {
  return value.replace(/\t/g, " ").replace(/\r?\n/g, " ").trim();
}

function formatPriceNad(amount: number) {
  const safe = Number.isFinite(amount) ? Math.max(0, amount) : 0;
  return `${safe.toFixed(2)} NAD`;
}

function productType(product: Product) {
  const hub = CATEGORIES.find((c) => c.slug === product.category)?.name ?? product.category;
  const sub = SUBCATEGORY_LABELS[product.subcategory] ?? product.subcategory;
  return sub && sub !== "More" ? `${hub} > ${sub}` : hub;
}

function rowFromProduct(product: Product, size: string, stock: number): string | null {
  const images = [product.imageUrl, ...(product.images ?? [])]
    .filter(Boolean)
    .map((url) => metaAbsoluteUrl(url));
  const unique = [...new Set(images)];
  const imageLink = unique[0];
  if (!imageLink) return null;

  const title = (product.displayName || product.name || product.title || product.code).slice(0, 150);
  const description = (product.description || productDescription(product)).slice(0, 5000);
  const price = product.unitPrice || product.price;
  const extraImages = unique.slice(1, 11).join(",");

  const cells = [
    feedVariantId(product.code, size),
    feedGroupId(product.code),
    title,
    description,
    stock > 0 ? "in stock" : "out of stock",
    "new",
    formatPriceNad(price),
    metaAbsoluteUrl(productPath(product.code)),
    imageLink,
    extraImages,
    "RAPPI",
    productType(product),
    GOOGLE_CATEGORY[product.category] ?? "Sporting Goods",
    `Size:${size}`,
  ].map(tsvCell);

  return cells.join("\t");
}

function rowsForProduct(product: Product): string[] {
  const variants = product.sizes.length
    ? product.sizes
    : [{ size: "OS", stock: product.stockQty }];
  return variants
    .map((row) => rowFromProduct(product, row.size, row.stock))
    .filter((line): line is string => Boolean(line));
}

export function metaCatalogFeedHeader() {
  return FEED_COLUMNS.join("\t");
}

export function metaCatalogFeedLines(catalog: Product[]) {
  return catalog.flatMap(rowsForProduct);
}

export async function buildMetaCatalogTsv() {
  const catalog = (await getCatalog()).filter(
    (product) => product.code !== "DPO-TEST" && product.available !== false,
  );
  return [metaCatalogFeedHeader(), ...metaCatalogFeedLines(catalog)].join("\n") + "\n";
}

export function metaCatalogFeedFilename() {
  return "rappi-meta-catalog.tsv";
}

export function metaCatalogPublicUrl() {
  const token = process.env.META_CATALOG_FEED_TOKEN ?? "";
  const qs = token ? `?token=${encodeURIComponent(token)}` : "";
  return `${metaSiteUrl()}/api/feeds/meta-catalog${qs}`;
}
