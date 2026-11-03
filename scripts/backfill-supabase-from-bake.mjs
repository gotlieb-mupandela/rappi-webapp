/**
 * One-time: push the baked catalog (data/products.json) into Supabase.
 *
 *   node scripts/backfill-supabase-from-bake.mjs
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

function loadEnvLocal() {
  const raw = readFileSync(".env.local", "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const i = trimmed.indexOf("=");
    if (i <= 0) continue;
    const key = trimmed.slice(0, i).trim();
    let val = trimmed.slice(i + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnvLocal();

const PRODUCT_BATCH = 200;
const SIZE_BATCH = 800;
const SELL_AS = new Set(["pack", "assortment", "multipack"]);

function toProductRow(row, fallbackCategory) {
  const sellAs = SELL_AS.has(row.sellAs) ? row.sellAs : null;
  return {
    id: row.id,
    code: row.code,
    item: row.item ?? "",
    title: row.title ?? "",
    name: row.name ?? "",
    display_name: row.displayName ?? row.name ?? "",
    category_slug: row.category || fallbackCategory,
    subcategory: row.subcategory || "general",
    gender: row.gender || "unisex",
    price: Number(row.price) || 0,
    unit_price: Number(row.unitPrice) || 0,
    currency: row.currency || "NAD",
    sheet_category: row.sheetCategory ?? null,
    badge: row.badge ?? null,
    image_url: row.imageUrl || "",
    images: Array.isArray(row.images) ? row.images : row.imageUrl ? [row.imageUrl] : [],
    description: row.description || "",
    hubs: Array.isArray(row.hubs) ? row.hubs : [],
    available: row.available !== false,
    sell_as: sellAs,
    pack_size: Number.isFinite(Number(row.packSize)) ? Number(row.packSize) : null,
  };
}

async function rpc(admin, name, args) {
  const { data, error } = await admin.rpc(name, args);
  if (error) throw new Error(`${name}: ${error.message}`);
  return data;
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");

  const catalog = JSON.parse(readFileSync("data/products.json", "utf8"));
  if (!Array.isArray(catalog) || !catalog.length) throw new Error("Empty products.json");

  const admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: categories, error: catError } = await admin.from("categories").select("slug");
  if (catError) throw new Error(catError.message);
  const slugs = new Set((categories ?? []).map((c) => c.slug));
  const fallback = slugs.has("sportswear") ? "sportswear" : [...slugs][0];

  let remapped = 0;
  const products = catalog.map((row) => {
    const mapped = toProductRow(row, fallback);
    if (!slugs.has(mapped.category_slug)) {
      mapped.category_slug = fallback;
      remapped += 1;
    }
    return mapped;
  });

  console.log(JSON.stringify({ products: products.length, remappedCategories: remapped }));

  let productWrites = 0;
  for (let i = 0; i < products.length; i += PRODUCT_BATCH) {
    const n = await rpc(admin, "_sync_upsert_products", {
      rows: products.slice(i, i + PRODUCT_BATCH),
    });
    productWrites += Number(n) || 0;
    if (i === 0 || (i / PRODUCT_BATCH) % 10 === 0) {
      console.log(`products ${Math.min(i + PRODUCT_BATCH, products.length)}/${products.length}`);
    }
  }

  const sizes = [];
  const keep = new Set();
  const productIds = [];
  for (const row of catalog) {
    productIds.push(row.id);
    for (const sz of row.sizes || []) {
      const size = String(sz.size || "").trim();
      if (!size) continue;
      sizes.push({
        product_id: row.id,
        size,
        stock: Math.max(0, Number(sz.stock) || 0),
      });
      keep.add(`${row.id}|${size}`);
    }
  }

  let sizeWrites = 0;
  for (let i = 0; i < sizes.length; i += SIZE_BATCH) {
    const n = await rpc(admin, "_sync_upsert_sizes", {
      rows: sizes.slice(i, i + SIZE_BATCH),
    });
    sizeWrites += Number(n) || 0;
    if (i === 0 || (i / SIZE_BATCH) % 10 === 0) {
      console.log(`sizes ${Math.min(i + SIZE_BATCH, sizes.length)}/${sizes.length}`);
    }
  }

  let pruned = 0;
  for (let i = 0; i < productIds.length; i += 200) {
    const ids = productIds.slice(i, i + 200);
    const { data: existing, error } = await admin
      .from("product_sizes")
      .select("id, product_id, size")
      .in("product_id", ids);
    if (error) throw new Error(error.message);
    const extra = (existing ?? [])
      .filter((row) => !keep.has(`${row.product_id}|${row.size}`))
      .map((row) => row.id);
    if (!extra.length) continue;
    const { error: delError } = await admin.from("product_sizes").delete().in("id", extra);
    if (delError) throw new Error(delError.message);
    pruned += extra.length;
  }

  const bakeCodes = new Set(catalog.map((row) => row.code));
  const extraProducts = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await admin
      .from("products")
      .select("id, code")
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    for (const row of data ?? []) {
      if (!bakeCodes.has(row.code)) extraProducts.push(row);
    }
    if (!data || data.length < 1000) break;
  }
  if (extraProducts.length) {
    const { error: hideError } = await admin
      .from("products")
      .update({ available: false })
      .in(
        "id",
        extraProducts.map((p) => p.id),
      );
    if (hideError) console.warn("hide extra failed", hideError.message);
    console.log("extraProducts", extraProducts.map((p) => p.code));
  }

  const bakedIds = catalog.map((row) => row.id);
  for (let i = 0; i < bakedIds.length; i += 500) {
    const { error: resetError } = await admin
      .from("products")
      .update({ content_changed_at: null })
      .in("id", bakedIds.slice(i, i + 500))
      .not("content_changed_at", "is", null);
    if (resetError) console.warn("content_changed_at reset failed", resetError.message);
  }

  console.log(
    JSON.stringify(
      {
        productWrites,
        sizeWrites,
        prunedSizes: pruned,
        extraHidden: extraProducts.length,
        bakeCount: catalog.length,
        bakePrice: Math.round(catalog.reduce((s, p) => s + (Number(p.price) || 0), 0)),
        bakeStock: catalog.reduce((s, p) => s + (Number(p.stockQty) || 0), 0),
        bakeHidden: catalog.filter((p) => p.available === false).length,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
