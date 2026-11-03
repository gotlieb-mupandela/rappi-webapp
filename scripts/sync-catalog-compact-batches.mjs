import fs from "fs";
import path from "path";

const products = JSON.parse(fs.readFileSync("data/products.json", "utf8"));
const outDir = path.join("tmp", "catalog-sync-compact");
fs.mkdirSync(outDir, { recursive: true });
for (const f of fs.readdirSync(outDir)) fs.unlinkSync(path.join(outDir, f));

const PRODUCT_BATCH = 300;
const SIZE_BATCH = 1500;
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
    sheet_category: row.sheetCategory ?? null,
    image_url: row.imageUrl,
    // Full gallery kept for a second pass; primary URL is enough for cards.
    images: (row.images || []).slice(0, 6),
  }));
  const payload = JSON.stringify(slice).replace(/'/g, "''");
  fs.writeFileSync(
    path.join(outDir, `p_${String(p).padStart(3, "0")}.sql`),
    `select public._sync_upsert_products('${payload}'::jsonb) as n;`,
  );
  p++;
}

const sizes = [];
for (const row of products) {
  for (const sz of row.sizes || []) {
    sizes.push([row.id, sz.size, Math.max(0, Number(sz.stock) || 0)]);
  }
}

for (let i = 0; i < sizes.length; i += SIZE_BATCH) {
  const slice = sizes.slice(i, i + SIZE_BATCH).map(([product_id, size, stock]) => ({
    product_id,
    size,
    stock,
  }));
  const payload = JSON.stringify(slice).replace(/'/g, "''");
  fs.writeFileSync(
    path.join(outDir, `s_${String(s).padStart(3, "0")}.sql`),
    `select public._sync_upsert_sizes('${payload}'::jsonb) as n;`,
  );
  s++;
}

const sizes_bytes = fs.statSync(path.join(outDir, "s_000.sql")).size;
const prod_bytes = fs.statSync(path.join(outDir, "p_000.sql")).size;
fs.writeFileSync(
  path.join(outDir, "manifest.json"),
  JSON.stringify({ productBatches: p, sizeBatches: s, products: products.length, sizes: sizes.length, prod_bytes, sizes_bytes }),
);
console.log({ productBatches: p, sizeBatches: s, prod_bytes, sizes_bytes });
