#!/usr/bin/env node
/**
 * Generate products_XXXX.sql batches from data/products.json.
 * Usage: node sync-catalog-to-sql-batches.mjs [start] [end]
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'tmp', 'catalog-sync');
const products = JSON.parse(fs.readFileSync(path.join(root, 'data', 'products.json'), 'utf8'));
const batchSize = 120;
const start = Number(process.argv[2] ?? 0);
const end = Number(process.argv[3] ?? Math.ceil(products.length / batchSize) - 1);

function lit(v) {
  if (v === null || v === undefined) return 'null';
  return `'${String(v).replace(/'/g, "''")}'`;
}

function arr(values) {
  if (!values?.length) return "'{}'";
  return `ARRAY[${values.map(lit).join(', ')}]`;
}

function sqlForSlice(slice) {
  const lines = [
    'insert into public.products (id, code, item, title, name, display_name, category_slug, subcategory, gender, price, unit_price, currency, sheet_category, badge, image_url, images) values',
    ...slice.map((p) => {
      const badge = p.badge ? `${lit(p.badge)}::public.product_badge` : 'null';
      return `  (${[
        lit(p.id),
        lit(p.code),
        lit(p.item),
        lit(p.title),
        lit(p.name),
        lit(p.displayName),
        lit(p.category),
        lit(p.subcategory),
        `${lit(p.gender)}::public.gender`,
        p.price,
        p.unitPrice,
        lit(p.currency),
        lit(p.sheetCategory),
        badge,
        lit(p.imageUrl),
        arr(p.images),
      ].join(', ')})`;
    }),
    'on conflict (id) do update set code = excluded.code, item = excluded.item, title = excluded.title, name = excluded.name, display_name = excluded.display_name, category_slug = excluded.category_slug, subcategory = excluded.subcategory, gender = excluded.gender, price = excluded.price, unit_price = excluded.unit_price, currency = excluded.currency, sheet_category = excluded.sheet_category, badge = excluded.badge, image_url = excluded.image_url, images = excluded.images;',
  ];
  return `${lines.join('\n')}\n`;
}

fs.mkdirSync(outDir, { recursive: true });
const written = [];
for (let i = start; i <= end; i++) {
  const from = i * batchSize;
  const slice = products.slice(from, from + batchSize);
  if (!slice.length) break;
  const file = path.join(outDir, `products_${String(i).padStart(4, '0')}.sql`);
  const sql = sqlForSlice(slice);
  fs.writeFileSync(file, sql, 'utf8');
  written.push({ index: i, file: path.basename(file), rows: slice.length, bytes: Buffer.byteLength(sql, 'utf8') });
}
console.log(JSON.stringify({ totalProducts: products.length, batchSize, start, end, written }, null, 2));
