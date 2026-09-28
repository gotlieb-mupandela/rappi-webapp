#!/usr/bin/env node
/**
 * Guardrail for the pack-retail policy (code/data only, no supplier fetch).
 *
 * Driven by data/b2c-price-fix-data.json + data/b2c-map-b.json:
 * - every pack_price_overrides row: catalog.price == pack_nad (literal),
 *   hidden rows stay available === false, live rows stay purchasable and
 *   match the public listing index (flags carried for client render).
 * - baked displayName/title carry no pack suffix (render localizes it).
 * - every hidden_packs row: available === false and absent from the index.
 * - every MAP B row: catalog + index price == snapped NAD.
 * - no unit-NAD leftovers on mapped codes, FX/markup unchanged (18 / 0.45).
 */
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const catalogPath = path.join(root, "data", "products.json");
const listingPath = path.join(root, "public", "listing-index.json");
const markupPath = path.join(root, "data", "retail-markup.json");
const fixPath = path.join(root, "data", "b2c-price-fix-data.json");
const mapBPath = path.join(root, "data", "b2c-map-b.json");

// Unit-retail NAD that must never reappear as a selling price on mapped codes.
// (783 excluded: it is the legitimate pack NAD for 101686.* bibs.)
const UNIT_NAD = new Set([215, 117, 176, 98, 78, 128, 74, 64]);

function fail(msg) {
  console.error(`FAIL ${msg}`);
  process.exitCode = 1;
}

const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
const listing = JSON.parse(fs.readFileSync(listingPath, "utf8"));
const byCode = new Map(catalog.map((p) => [p.code, p]));
const listingByCode = new Map(listing.map((p) => [p.code, p]));
const fix = JSON.parse(fs.readFileSync(fixPath, "utf8"));
const hidden = new Set((fix.hidden_packs || []).map((s) => s.code));

function titleWording(o) {
  // Bake stores locale-neutral base names: no EN pack suffix may be baked
  // into displayName/title (render adds it per locale via packTitleSuffix).
  const p = byCode.get(o.code);
  for (const field of [p.displayName, p.title]) {
    if (/\s*·\s*(pack of \d+|pack|assortment pack|multipack)\s*$/i.test(field || "")) {
      fail(`${o.code} baked EN pack suffix in title`);
    }
  }
  // ...but multipack wording must still be discoverable in the base name.
  if (o.sell_as === "multipack") {
    const hay = [p.displayName, p.title, p.name].join(" ");
    if (!/\bmultipack\b/i.test(hay)) fail(`${o.code} base name missing Multipack`);
  }
}

// Pack overrides: literal pack NAD, correct availability, index + titles.
for (const o of fix.pack_price_overrides || []) {
  const p = byCode.get(o.code);
  if (!p) {
    fail(`missing pack SKU ${o.code}`);
    continue;
  }
  if (p.price !== o.pack_nad || p.unitPrice !== o.pack_nad) {
    fail(`${o.code} price ${p.price}/${p.unitPrice}, expected pack NAD ${o.pack_nad}/${o.pack_nad}`);
  }
  if (!Number.isInteger(p.price)) fail(`${o.code} non-integer NAD`);
  if (UNIT_NAD.has(p.price)) fail(`${o.code} still at unit NAD ${p.price}`);
  if (o.sell_as && p.sellAs !== o.sell_as) {
    fail(`${o.code} sellAs ${p.sellAs}, expected ${o.sell_as}`);
  }
  if (o.pack_size && o.pack_size > 1 && p.packSize !== o.pack_size) {
    fail(`${o.code} packSize ${p.packSize}, expected ${o.pack_size}`);
  }
  if (hidden.has(o.code)) {
    if (p.available !== false) fail(`${o.code} should stay hidden`);
    if (listingByCode.has(o.code)) fail(`${o.code} still appears in public listing index`);
    continue;
  }
  if (p.available === false) fail(`${o.code} should be purchasable at pack NAD ${o.pack_nad}`);
  const indexed = listingByCode.get(o.code);
  if (!indexed) fail(`${o.code} missing from public listing index`);
  else {
    if (indexed.price !== o.pack_nad || indexed.unitPrice !== o.pack_nad) {
      fail(`${o.code} listing price ${indexed.price}/${indexed.unitPrice}, expected ${o.pack_nad}/${o.pack_nad}`);
    }
    // Client render needs the flags (badge/title localize from these).
    if (o.sell_as && indexed.sellAs !== o.sell_as) {
      fail(`${o.code} listing missing sellAs=${o.sell_as}`);
    }
    if (o.pack_size && o.pack_size > 1 && indexed.packSize !== o.pack_size) {
      fail(`${o.code} listing missing packSize=${o.pack_size}`);
    }
  }
  titleWording(o);
}

// Hidden packs: never purchasable, never indexed.
for (const s of fix.hidden_packs || []) {
  const p = byCode.get(s.code);
  if (!p) {
    console.log(`info hidden pack missing in catalog ${s.code}`);
    continue;
  }
  if (p.available !== false) fail(`hidden pack ${s.code} still available at ${p.price}`);
  if (listingByCode.has(s.code)) fail(`hidden pack ${s.code} still appears in public listing index`);
}

// MAP B off-by-1 snaps: catalog + index must carry the exact integers.
const mapB = JSON.parse(fs.readFileSync(mapBPath, "utf8"));
let mapBChecked = 0;
for (const [code, nad] of Object.entries(mapB.prices)) {
  const p = byCode.get(code);
  if (!p) {
    fail(`MAP B SKU missing in catalog ${code}`);
    continue;
  }
  if (p.price !== nad || p.unitPrice !== nad) {
    fail(`MAP B ${code} price ${p.price}/${p.unitPrice}, expected ${nad}/${nad}`);
  }
  const indexed = listingByCode.get(code);
  if (indexed && (indexed.price !== nad || indexed.unitPrice !== nad)) {
    fail(`MAP B ${code} listing ${indexed.price}/${indexed.unitPrice}, expected ${nad}/${nad}`);
  }
  mapBChecked++;
}
if (mapBChecked !== mapB.count) fail(`MAP B checked ${mapBChecked}, expected ${mapB.count}`);

// Former footwear-threshold SKUs: no baked Assortment/Pack size-run wording
// (render localizes it); pack sizes recorded as flags, not invented.
for (const [code, n] of [["RR500W2602", 8], ["BF111JS2629V", 12]]) {
  const p = byCode.get(code);
  if (!p) {
    fail(`missing SKU ${code}`);
    continue;
  }
  // Baked base names stay neutral; pack counts live in flags for render.
  const hay = [p.displayName, p.title, p.name].join(" ");
  if (/assortment pack|pack of \d+|\bmultipack\b|wholesale assortment|size run/i.test(hay)) {
    fail(`${code} still shows assortment/pack wording`);
  }
  if (p.sellAs !== "assortment" || p.packSize !== n) {
    fail(`${code} flags sellAs=${p.sellAs} packSize=${p.packSize}, expected assortment/${n}`);
  }
  if (p.available === false) fail(`${code} should stay purchasable`);
}

// No-EN-bake regression net: bake stores neutral base names, so no baked
// displayName/title may end with a pack suffix in any language. Render adds
// the wording per locale via packTitleSuffix.
for (const p of catalog) {
  for (const field of [p.displayName, p.title]) {
    if (/\s*·\s*(pack of \d+|pack|assortment pack|multipack)\s*$/i.test(field || "")) {
      fail(`${p.code} baked EN pack suffix in title`);
    }
  }
}

// No unavailable catalog row should leak into any public browse index.
for (const p of catalog) {
  if (p.available === false && listingByCode.has(p.code)) {
    fail(`unavailable ${p.code} still appears in public listing index`);
  }
}
for (const p of listing) {
  if (p.available === false) fail(`listing index contains unavailable ${p.code}`);
}

// Headline regression asserts from the task verify matrix.
for (const [code, nad] of [
  ["400855.220", 9396],
  ["401955.215", 2584],
  ["401955.216", 2584],
  ["401955.217", 2584],
  ["400089.100", 2819],
  ["400089.200", 2819],
  ["400056.100", 1762],
  ["400360.100", 1409],
  ["101686.010", 783],
  ["101686.200", 783],
  ["400356.308", 3758],
  ["TI41800B5101", 3495],
]) {
  const p = byCode.get(code);
  if (!p) fail(`missing SKU ${code}`);
  else if (p.price !== nad) fail(`${code} price ${p.price}, expected pack NAD ${nad}`);
}

// FX / markup unchanged
const markup = JSON.parse(fs.readFileSync(markupPath, "utf8"));
if (Number(markup.fx) !== 18 || Number(markup.markup) !== 0.45) {
  fail(`retail-markup changed: fx=${markup.fx} markup=${markup.markup}, expected 18/0.45`);
}

if (process.exitCode) {
  console.error("pack-price guardrail FAILED");
} else {
  console.log(
    `ok pack-price guardrail: ${(fix.pack_price_overrides || []).length} pack overrides + ${mapBChecked} MAP B snaps + hidden SKUs absent from index + fx/markup 18/0.45`,
  );
}
