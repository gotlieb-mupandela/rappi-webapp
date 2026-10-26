#!/usr/bin/env node
// HELD. Not run by anyone. Not wired to any route. Needs Gotlieb's yes (via David) and Security's review first.
// Builds the Supabase write that mirrors PR #107 for public.products.images and public.products.image_url.
// Default: dry run, prints counts only. It never connects to a database and never reads a key.
//   node docs/image-parity/held-supabase/apply-images.mjs              counts only
//   node docs/image-parity/held-supabase/apply-images.mjs --emit-sql   prints ONE-transaction SQL to stdout
// The operator applies the SQL with psql using the DATABASE_URL env var (never a key from the repo, never logged):
//   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f apply-images.sql
// Backup taken read-only before this (box only, not in git): /workspace/image-parity-backup/supabase-products-images.json
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const products = JSON.parse(readFileSync(join(ROOT, "data/products.json"), "utf8"));
const { indexes, logoOnlyNotOnStore } = JSON.parse(
  readFileSync(join(ROOT, "data/store-image-indexes.json"), "utf8"),
);
const BASE = "https://www.joma-sport.com/on/demandware.static/-/Sites-joma-masterCatalog/default/images/medium/";
const CODE = /^[A-Za-z0-9._-]{1,40}$/;
const SQL_RE = "^https://www\\.joma-sport\\.com/on/demandware\\.static/-/Sites-joma-masterCatalog/default/images/medium/[A-Za-z0-9._-]+_[0-9]+\\.jpg$";

function validUrl(code, url) {
  if (typeof url !== "string" || /[\s'"?#%\\]/.test(url)) return false;
  if (!url.startsWith(BASE)) return false;
  const rest = url.slice(BASE.length);
  const m = /^(.+)_([0-9]+)\.jpg$/.exec(rest);
  return Boolean(m && m[1] === code);
}

const clear = new Set(logoOnlyNotOnStore ?? []);
const rows = [];
const bad = [];
for (const p of products) {
  if (!CODE.test(p.code ?? "")) continue;
  if (indexes[p.code]) {
    const imgs = p.images ?? [];
    if (!imgs.length || !imgs.every((u) => validUrl(p.code, u)) || p.imageUrl !== imgs[0]) bad.push(p.code);
    else rows.push({ code: p.code, imageUrl: imgs[0], images: imgs });
  } else if (clear.has(p.code)) {
    rows.push({ code: p.code, imageUrl: "", images: [] });
  }
}
if (bad.length) {
  console.error(`refusing: ${bad.length} products fail the store URL pattern`);
  process.exit(1);
}

if (!process.argv.includes("--emit-sql")) {
  console.log(JSON.stringify({ mode: "dry-run", rowsToSet: rows.length, storeGalleries: rows.length - clear.size, clearedLogoOnly: clear.size }));
  process.exit(0);
}

const lit = (s) => `'${s}'`; // safe: codes match CODE, URLs fail validation on quotes and backslashes
const values = rows.map((r) => `(${lit(r.code)},${lit(r.imageUrl)},ARRAY[${r.images.map(lit).join(",")}]::text[])`);
console.log(`-- HELD. Generated from data/products.json. Run only after Gotlieb's yes and Security's review.
-- Backup: /workspace/image-parity-backup/supabase-products-images.json (read-only SELECT, box only)
BEGIN;
CREATE TEMP TABLE image_sync(code text PRIMARY KEY, image_url text NOT NULL, images text[] NOT NULL) ON COMMIT DROP;
INSERT INTO image_sync(code, image_url, images) VALUES
${values.join(",\n")};
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM image_sync s
    WHERE (cardinality(s.images) > 0 AND s.image_url <> s.images[1])
       OR EXISTS (SELECT 1 FROM unnest(s.images) u WHERE u !~ '${SQL_RE}' OR u NOT LIKE '%/' || s.code || '\\_%.jpg')
  ) THEN
    RAISE EXCEPTION 'image_sync validation failed';
  END IF;
END $$;
UPDATE public.products p
   SET images = s.images, image_url = s.image_url
  FROM image_sync s
 WHERE p.code = s.code
   AND (p.images IS DISTINCT FROM s.images OR p.image_url IS DISTINCT FROM s.image_url);
COMMIT;`);
