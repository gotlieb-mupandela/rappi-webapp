import fs from "fs";
import path from "path";

const products = JSON.parse(fs.readFileSync("data/products.json", "utf8"));
const outDir = path.join("tmp", "catalog-sync-json");
fs.mkdirSync(outDir, { recursive: true });
for (const f of fs.readdirSync(outDir)) fs.unlinkSync(path.join(outDir, f));

const PRODUCT_BATCH = 200;
const SIZE_BATCH = 1000;
let p = 0;
let s = 0;

for (let i = 0; i < products.length; i += PRODUCT_BATCH) {
  const slice = products.slice(i, i + PRODUCT_BATCH).map((row) => ({
    id: row.id,
    code: row.code,
    item: row.item,
    title: row.title,
    name: row.name,
    display_name: row.displayName,
    category_slug: row.category,
    subcategory: row.subcategory,
    gender: row.gender,
    price: Number(row.price) || 0,
    unit_price: Number(row.unitPrice) || 0,
    currency: row.currency || "NAD",
    sheet_category: row.sheetCategory ?? null,
    badge: row.badge ?? null,
    image_url: row.imageUrl,
    images: row.images || [],
  }));
  const payload = JSON.stringify(slice).replace(/'/g, "''");
  const sql = `select public._sync_upsert_products('${payload}'::jsonb) as n;`;
  fs.writeFileSync(path.join(outDir, `p_${String(p).padStart(4, "0")}.sql`), sql);
  p++;
}

const sizes = [];
for (const row of products) {
  for (const sz of row.sizes || []) {
    sizes.push({
      product_id: row.id,
      size: sz.size,
      stock: Math.max(0, Number(sz.stock) || 0),
    });
  }
}

for (let i = 0; i < sizes.length; i += SIZE_BATCH) {
  const slice = sizes.slice(i, i + SIZE_BATCH);
  const payload = JSON.stringify(slice).replace(/'/g, "''");
  const sql = `select public._sync_upsert_sizes('${payload}'::jsonb) as n;`;
  fs.writeFileSync(path.join(outDir, `s_${String(s).padStart(4, "0")}.sql`), sql);
  s++;
}

fs.writeFileSync(
  path.join(outDir, "manifest.json"),
  JSON.stringify({ productBatches: p, sizeBatches: s, products: products.length, sizes: sizes.length }),
);
console.log({ productBatches: p, sizeBatches: s, sample: fs.statSync(path.join(outDir, "p_0000.sql")).size });
