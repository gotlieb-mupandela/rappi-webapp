#!/usr/bin/env node
// Sync baked product galleries in data/products.json to the public store's gallery.
// Plain node, no deps. DRY RUN by default: writes docs/image-parity/* reports only.
//   node scripts/sync-store-images.mjs                 dry run
//   node scripts/sync-store-images.mjs --write         patch data/products.json
//   --keep-our-order   leave products whose only change is order as they are (reverts that part)
//   --indexes <file>   code to store index data (default data/store-image-indexes.json)
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const WRITE = args.includes("--write");
const KEEP_ORDER = args.includes("--keep-our-order");
const idxArg = args.indexOf("--indexes");
const INDEX_FILE = idxArg >= 0 ? args[idxArg + 1] : join(ROOT, "data/store-image-indexes.json");
const PRODUCTS = join(ROOT, "data/products.json");
const OUT = join(ROOT, "docs/image-parity");
const SITE = "https://www.rappisportshub.com";

// Same format as scripts/enrich-demandware-images.mjs demandwareUrl(code, n).
const DW_BASE =
  "https://www.joma-sport.com/on/demandware.static/-/Sites-joma-masterCatalog/default/images/medium";
export function storeUrl(code, n) {
  return `${DW_BASE}/${code}_${n}.jpg`;
}

const data = JSON.parse(readFileSync(INDEX_FILE, "utf8"));
const indexes = data.indexes;
const logoClear = new Set(data.logoOnlyNotOnStore ?? []);
const raw = readFileSync(PRODUCTS, "utf8");
const products = JSON.parse(raw);
if (JSON.stringify(products) + "\n" !== raw) throw new Error("products.json format is not JSON.stringify + newline; refusing");

const isLogo = (u) => /\/brand\/rappi-logo/i.test(u);
const isB2B = (u) => /v1\.joma-sport\.net/i.test(u);
const isRel = (u) => typeof u === "string" && u.startsWith("/");
const csv = (v) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

const rows = [];
const reorderRows = [];
const backup = {};
const counts = {};
let changed = 0;
let unchanged = 0;
let reorderedOnly = 0;
let skippedReorder = 0;

for (const p of products) {
  const oldImages = Array.isArray(p.images) ? p.images : [];
  const oldPrimary = p.imageUrl ?? "";
  const old = [...new Set([oldPrimary, ...oldImages].filter(Boolean))];
  let next;
  const tags = [];
  if (indexes[p.code]) {
    const urls = indexes[p.code].map((n) => storeUrl(p.code, n));
    next = { imageUrl: urls[0], images: urls };
    const storeSet = new Set(urls);
    const oldSet = new Set(old);
    if (old.some(isLogo)) tags.push("LOGO_ONLY");
    if (old.some(isB2B)) tags.push("B2B_DROPPED");
    if (old.some(isRel)) tags.push("RELATIVE_TO_STORE");
    if (urls.some((u) => !oldSet.has(u))) tags.push("ADDED_STORE_PHOTOS");
    if (old.some((u) => !storeSet.has(u) && !isLogo(u) && !isB2B(u) && !isRel(u))) tags.push("OTHER_EXTRA_DROPPED");
  } else if (logoClear.has(p.code)) {
    next = { imageUrl: "", images: [] };
    tags.push("LOGO_ONLY_CLEARED");
  } else if (old.some(isRel) && !old.some(isLogo)) {
    const fix = (u) => (isRel(u) && !u.startsWith("/products/") ? SITE + u : u);
    next = { imageUrl: fix(oldPrimary), images: oldImages.map(fix) };
    tags.push("RELATIVE_PREFIXED");
  } else {
    unchanged++;
    continue;
  }
  const same =
    next.imageUrl === oldPrimary &&
    next.images.length === oldImages.length &&
    next.images.every((u, i) => u === oldImages[i]);
  if (same) {
    unchanged++;
    continue;
  }
  if (tags.length === 0) {
    tags.push("REORDERED_ONLY");
    if (KEEP_ORDER) {
      skippedReorder++;
      unchanged++;
      continue;
    }
    reorderedOnly++;
    reorderRows.push([p.code, oldImages.join(" "), next.images.join(" "), "1"]);
  }
  changed++;
  for (const t of tags) counts[t] = (counts[t] ?? 0) + 1;
  backup[p.code] = { imageUrl: oldPrimary, images: oldImages };
  rows.push([p.code, oldImages.join(" "), next.images.join(" "), tags.join(";")]);
  if (WRITE) {
    p.imageUrl = next.imageUrl;
    p.images = next.images;
  }
}

mkdirSync(OUT, { recursive: true });
const toCsv = (head, list) => [head, ...list.map((r) => r.map(csv).join(","))].join("\n") + "\n";
writeFileSync(join(OUT, "dry-run.csv"), toCsv("code,old_images,new_images,reason", rows));
writeFileSync(
  join(OUT, "reordered-only.csv"),
  toCsv("code,old_images,new_images,revert_with_keep_our_order", reorderRows),
);
writeFileSync(join(OUT, "backup-old-images.json"), JSON.stringify(backup, null, 1) + "\n");

const summary = { mode: WRITE ? "write" : "dry-run", products: products.length, changed, unchanged, reorderedOnly, skippedReorder, perReason: counts };
console.log(JSON.stringify(summary, null, 2));

if (WRITE) {
  const out = JSON.stringify(products) + "\n";
  if (JSON.parse(out).length !== products.length) throw new Error("product count changed");
  writeFileSync(PRODUCTS, out);
  console.log("wrote data/products.json");
}
