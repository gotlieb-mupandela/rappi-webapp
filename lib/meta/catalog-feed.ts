import "server-only";

import { CATEGORIES, SUBCATEGORY_LABELS } from "@/lib/catalog";
import { withStorefrontMerchandising } from "@/lib/classify";
import { productDescription } from "@/lib/copy";
import { feedGroupId, feedVariantId } from "@/lib/meta/ids";
import { metaAbsoluteUrl, metaSiteUrl } from "@/lib/meta/site";
import { offlineCatalog } from "@/lib/offline-catalog";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/database.types";
import type { Product } from "@/lib/types";
import { productPath } from "@/lib/utils";

type ProductRow = Database["public"]["Tables"]["products"]["Row"];
type SizeRow = Pick<
  Database["public"]["Tables"]["product_sizes"]["Row"],
  "product_id" | "size" | "stock"
>;

const PRODUCT_PAGE = 400;
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

function mapLiveProduct(row: ProductRow, sizes: { size: string; stock: number }[]): Product {
  return withStorefrontMerchandising({
    id: row.id,
    code: row.code,
    item: row.item,
    title: row.title,
    name: row.name,
    displayName: row.display_name,
    category: row.category_slug,
    subcategory: row.subcategory,
    gender: row.gender as Product["gender"],
    price: Number(row.price),
    unitPrice: Number(row.unit_price),
    currency: "NAD",
    sheetCategory: row.sheet_category,
    totalQty: row.stock_qty,
    stockQty: row.stock_qty,
    badge: (row.badge ?? null) as Product["badge"],
    sizeOptions: sizes.map((s) => s.size),
    sizes,
    imageUrl: row.image_url,
    images: row.images ?? [],
    description: "",
  });
}

async function loadLiveProducts(): Promise<Product[] | null> {
  try {
    const admin = createAdminClient();
    const products: Product[] = [];
    for (let from = 0; ; from += PRODUCT_PAGE) {
      const { data: rows, error } = await admin
        .from("products")
        .select(
          "id, code, item, title, name, display_name, category_slug, subcategory, gender, price, unit_price, sheet_category, stock_qty, badge, image_url, images, created_at, currency, updated_at",
        )
        .order("code")
        .range(from, from + PRODUCT_PAGE - 1);
      if (error) throw error;
      if (!rows?.length) break;

      const { data: sizeRows, error: sizeError } = await admin
        .from("product_sizes")
        .select("product_id, size, stock")
        .in(
          "product_id",
          rows.map((row) => row.id),
        );
      if (sizeError) throw sizeError;

      const byProduct = new Map<string, SizeRow[]>();
      for (const size of sizeRows ?? []) {
        const list = byProduct.get(size.product_id) ?? [];
        list.push(size);
        byProduct.set(size.product_id, list);
      }

      for (const row of rows) {
        const sizes = (byProduct.get(row.id) ?? []).map((s) => ({
          size: s.size,
          stock: s.stock,
        }));
        products.push(mapLiveProduct(row, sizes));
      }

      if (rows.length < PRODUCT_PAGE) break;
    }
    return products.length ? products : null;
  } catch {
    return null;
  }
}

export function metaCatalogFeedHeader() {
  return FEED_COLUMNS.join("\t");
}

export function metaCatalogFeedLines(catalog: Product[]) {
  return catalog.flatMap(rowsForProduct);
}

export async function buildMetaCatalogTsv() {
  const catalog = (await loadLiveProducts()) ?? offlineCatalog;
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
