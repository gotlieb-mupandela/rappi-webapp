import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { FeedSource } from "../lib/mobile-feed";
import type { Product } from "../lib/types";

type FixtureRow = {
  code: string;
  name?: string;
  displayName?: string;
  item?: string;
  title?: string;
  category?: Product["category"];
  subcategory?: string;
  gender?: Product["gender"];
  price?: number;
  imageUrl?: string;
  images?: string[];
  folders?: string[];
  available?: boolean;
  sellAs?: Product["sellAs"];
  packSize?: number | null;
};

const file = join(dirname(fileURLToPath(import.meta.url)), "fixtures/mobile-feed-products.json");

export function loadFixtureProducts(): FeedSource[] {
  const rows = JSON.parse(readFileSync(file, "utf8")) as FixtureRow[];
  return rows.map((row) => {
    const name = row.name ?? row.code;
    const price = row.price ?? 100;
    const imageUrl = row.imageUrl ?? "";
    const product: FeedSource = {
      id: row.code,
      code: row.code,
      item: row.item ?? name,
      title: row.title ?? name,
      name,
      displayName: row.displayName ?? name,
      category: row.category ?? "sportswear",
      subcategory: row.subcategory ?? "tees",
      gender: row.gender ?? "unisex",
      price,
      unitPrice: price,
      currency: "NAD",
      sheetCategory: null,
      totalQty: 4,
      stockQty: 4,
      badge: null,
      sizeOptions: ["M"],
      sizes: [{ size: "M", stock: 4 }],
      imageUrl,
      images: row.images ?? (imageUrl ? [imageUrl] : []),
      folders: row.folders ?? [],
      ...(row.available === false ? { available: false } : {}),
      ...(row.sellAs ? { sellAs: row.sellAs } : {}),
      ...(row.packSize != null ? { packSize: row.packSize } : {}),
    };
    return product;
  });
}
