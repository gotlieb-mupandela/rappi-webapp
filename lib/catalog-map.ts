import type { Json } from "@/lib/database.types";
import type { Product } from "@/lib/types";

export type StorefrontCatalogRow = {
  id: string | null;
  code: string | null;
  item: string | null;
  title: string | null;
  name: string | null;
  display_name: string | null;
  category_slug: string | null;
  subcategory: string | null;
  gender: Product["gender"] | null;
  price: number | null;
  unit_price: number | null;
  currency: string | null;
  sheet_category: string | null;
  stock_qty: number | null;
  badge: Product["badge"];
  image_url: string | null;
  images: string[] | null;
  description: string | null;
  hubs: string[] | null;
  available: boolean | null;
  sell_as: string | null;
  pack_size: number | null;
  sizes: Json | null;
};

function parseSizes(value: Json | null): Product["sizes"] {
  if (!Array.isArray(value)) return [];
  const sizes: Product["sizes"] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const size = String((raw as { size?: unknown }).size ?? "").trim();
    if (!size) continue;
    sizes.push({
      size,
      stock: Math.max(0, Number((raw as { stock?: unknown }).stock) || 0),
    });
  }
  return sizes;
}

function parseSellAs(value: string | null): Product["sellAs"] {
  if (value === "pack" || value === "assortment" || value === "multipack") return value;
  return undefined;
}

export function mapStorefrontRow(row: StorefrontCatalogRow): Product | null {
  if (!row.id || !row.code) return null;
  const sizes = parseSizes(row.sizes);
  const stockQty = Number(row.stock_qty) || sizes.reduce((sum, s) => sum + s.stock, 0);
  const hubs = (row.hubs ?? []).filter(Boolean);
  return {
    id: row.id,
    code: row.code,
    item: row.item ?? "",
    title: row.title ?? "",
    name: row.name ?? "",
    displayName: row.display_name ?? row.name ?? "",
    category: row.category_slug ?? "sportswear",
    ...(hubs.length ? { hubs } : {}),
    subcategory: row.subcategory ?? "general",
    gender: row.gender ?? "unisex",
    price: Number(row.price) || 0,
    unitPrice: Number(row.unit_price) || 0,
    currency: "NAD",
    sheetCategory: row.sheet_category,
    totalQty: stockQty,
    stockQty,
    badge: row.badge ?? null,
    sizeOptions: sizes.map((s) => s.size),
    sizes,
    imageUrl: row.image_url ?? "",
    images: row.images ?? [],
    description: row.description || undefined,
    available: row.available ?? true,
    sellAs: parseSellAs(row.sell_as),
    packSize: row.pack_size,
  };
}
