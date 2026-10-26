#!/usr/bin/env node
// Fails when a baked gallery drifts from the public store gallery.
// Plain node, no deps. Rules:
//  1. A product listed in data/store-image-indexes.json must have images equal to the
//     store URL list in ascending index order, and imageUrl equal to images[0].
//  2. No sellable product (available !== false) may have a logo-only gallery (/brand/rappi-logo).
//  3. No on-store product may have a v1.joma-sport.net URL (dead B2B host). Products not on
//     the store keep their v1 photos until Gotlieb decides (they are counted as "held", not failed).
// Hidden products (available === false) are reported as warnings for rule 2.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const products = JSON.parse(readFileSync(join(ROOT, "data/products.json"), "utf8"));
const { indexes } = JSON.parse(readFileSync(join(ROOT, "data/store-image-indexes.json"), "utf8"));
const DW_BASE =
  "https://www.joma-sport.com/on/demandware.static/-/Sites-joma-masterCatalog/default/images/medium";

const fails = [];
const warns = [];
let checked = 0;
let held = 0;
for (const p of products) {
  const images = Array.isArray(p.images) ? p.images : [];
  const all = [p.imageUrl, ...images].filter(Boolean);
  const want = indexes[p.code];
  if (want) {
    checked++;
    const urls = want.map((n) => `${DW_BASE}/${p.code}_${n}.jpg`);
    if (images.length !== urls.length || images.some((u, i) => u !== urls[i])) {
      fails.push(`${p.code} gallery is not the store list in store order`);
    } else if ((p.imageUrl ?? "") !== urls[0]) {
      fails.push(`${p.code} imageUrl is not the first store photo`);
    }
  }
  const sink = p.available === false ? warns : fails;
  if (all.length > 0 && all.every((u) => /\/brand\/rappi-logo/i.test(u))) sink.push(`${p.code} logo-only gallery`);
  if (all.some((u) => /v1\.joma-sport\.net/i.test(u))) {
    if (want) fails.push(`${p.code} has a v1.joma-sport.net URL`);
    else held++;
  }
}

console.log(`check:store-images products=${products.length} on-store-checked=${checked} failures=${fails.length} hidden-warnings=${warns.length} not-on-store-v1-held=${held}`);
for (const f of fails.slice(0, 50)) console.log(`FAIL ${f}`);
if (fails.length > 50) console.log(`... ${fails.length - 50} more failures`);
if (fails.length) process.exit(1);
console.log("PASS");
