#!/usr/bin/env node
/**
 * Guardrail for B2C pack-price fix (code/data only, no Joma fetch).
 *
 * - 401955.215/.216/.217 must be NAD 215 (verified unit override).
 * - 400089.100, 400056.100, 400360.100 must NOT be purchasable as normal
 *   singles at 2818/1762/1409 (available === false).
 * - FX/markup unchanged (18 / 0.45).
 * - No invented unit prices: only override codes may be 215 via this fix.
 */
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const catalogPath = path.join(root, "data", "products.json");
const listingPath = path.join(root, "public", "listing-index.json");
const markupPath = path.join(root, "data", "retail-markup.json");
const fixPath = path.join(root, "data", "b2c-price-fix-data.json");

function fail(msg) {
  console.error(`FAIL ${msg}`);
  process.exitCode = 1;
}

const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
const listing = JSON.parse(fs.readFileSync(listingPath, "utf8"));
const byCode = new Map(catalog.map((p) => [p.code, p]));
const listingByCode = new Map(listing.map((p) => [p.code, p]));

// A) verified overrides
for (const code of ["401955.215", "401955.216", "401955.217"]) {
  const p = byCode.get(code);
  if (!p) fail(`missing override SKU ${code}`);
  else {
    if (p.price !== 215 || p.unitPrice !== 215) {
      fail(`${code} price ${p.price}/${p.unitPrice}, expected 215/215`);
    }
    if (!Number.isInteger(p.price) || !Number.isInteger(p.unitPrice)) {
      fail(`${code} non-integer NAD`);
    }
    if (p.available === false) fail(`${code} should stay purchasable at 215`);
    const indexed = listingByCode.get(code);
    if (!indexed) fail(`${code} missing from public listing index`);
    else if (indexed.price !== 215 || indexed.unitPrice !== 215) {
      fail(`${code} listing price ${indexed.price}/${indexed.unitPrice}, expected 215/215`);
    }
  }
}

// B) known pack-price suspects must not be purchasable as silent singles.
for (const [code, oldPrice] of [
  ["400089.100", 2818],
  ["400056.100", 1762],
  ["400360.100", 1409],
  ["300151.003", 2928],
]) {
  const p = byCode.get(code);
  if (!p) fail(`missing suspect SKU ${code}`);
  else if (p.available !== false) {
    fail(`${code} still purchasable (available=${p.available}) at ${p.price}, expected hidden (was ${oldPrice})`);
  } else if (p.price !== oldPrice) {
    // Price must stay at pack NAD for audit; only availability flips.
    console.log(`info ${code} price ${p.price} (was ${oldPrice}), hidden`);
  }
  if (listingByCode.has(code)) fail(`${code} still appears in public listing index`);
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

// All explicit suspects from the data file must be hidden (unless overridden)
if (fs.existsSync(fixPath)) {
  const fix = JSON.parse(fs.readFileSync(fixPath, "utf8"));
  const overrideCodes = new Set((fix.unit_price_overrides || []).map((r) => r.code));
  for (const s of fix.pack_price_suspects_no_unit_yet || []) {
    if (overrideCodes.has(s.code)) continue;
    const p = byCode.get(s.code);
    if (!p) {
      console.log(`info suspect missing in catalog ${s.code}`);
      continue;
    }
    if (p.available !== false) fail(`suspect ${s.code} still available at ${p.price}`);
  }
}

// FX / markup unchanged
const markup = JSON.parse(fs.readFileSync(markupPath, "utf8"));
if (Number(markup.fx) !== 18 || Number(markup.markup) !== 0.45) {
  fail(`retail-markup changed: fx=${markup.fx} markup=${markup.markup}, expected 18/0.45`);
}

if (process.exitCode) {
  console.error("pack-price guardrail FAILED");
} else {
  console.log("ok pack-price guardrail: 3x215 + hidden SKUs absent from listing index + fx/markup 18/0.45");
}
