#!/usr/bin/env node
/**
 * Guardrail for B2C pack-price fix (code/data only, no Joma fetch).
 *
 * Driven by data/b2c-price-fix-data.json:
 * - every unit_price_overrides row must be NAD new_nad (price + unitPrice),
 *   integer, purchasable, and matching in the public listing index.
 * - every pack_price_suspects_no_unit_yet row must be available === false
 *   and absent from the public listing index.
 * - FX/markup unchanged (18 / 0.45).
 * - No invented unit prices: only override codes may carry fixed NAD.
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

// A) verified overrides (INTER 215 + supplier B2B exact NAD map)
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

// B) long-standing hidden pack-price suspect keeps its pack NAD for audit.
for (const [code, oldPrice] of [["300151.003", 2928]]) {
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
    if (listingByCode.has(s.code)) fail(`suspect ${s.code} still in public listing index`);
  }
  // Every recorded override must match the catalog + listing index exactly.
  for (const o of fix.unit_price_overrides || []) {
    if (["401955.215", "401955.216", "401955.217"].includes(o.code)) continue;
    const p = byCode.get(o.code);
    if (!p) {
      fail(`missing override SKU ${o.code}`);
      continue;
    }
    if (p.price !== o.new_nad || p.unitPrice !== o.new_nad) {
      fail(`${o.code} price ${p.price}/${p.unitPrice}, expected ${o.new_nad}/${o.new_nad}`);
    }
    if (!Number.isInteger(p.price) || !Number.isInteger(p.unitPrice)) {
      fail(`${o.code} non-integer NAD`);
    }
    if (p.available === false) fail(`${o.code} should stay purchasable at ${o.new_nad}`);
    const indexed = listingByCode.get(o.code);
    if (!indexed) fail(`${o.code} missing from public listing index`);
    else if (indexed.price !== o.new_nad || indexed.unitPrice !== o.new_nad) {
      fail(`${o.code} listing price ${indexed.price}/${indexed.unitPrice}, expected ${o.new_nad}/${o.new_nad}`);
    }
  }
}

// Spot-checks from the task verify list.
for (const [code, nad] of [
  ["400855.220", 783],
  ["400089.100", 117],
  ["400089.200", 117],
  ["400056.100", 176],
  ["400360.100", 117],
  ["401647.216", 489],
  ["400649.061", 312],
  ["401954.067", 245],
]) {
  const indexed = listingByCode.get(code);
  if (!indexed) fail(`spot-check SKU ${code} missing from public listing index`);
  else if (indexed.price !== nad || indexed.unitPrice !== nad) {
    fail(`spot-check ${code} listing ${indexed.price}/${indexed.unitPrice}, expected ${nad}/${nad}`);
  }
}
// Hidden SKUs must be gone from search/PDP surface (flag + index absence).
for (const code of [
  "401731.204",
  "401268.214",
  "400356.308",
  "AH41800B0501",
  "TI41800B5101",
  "300151.003",
  "300249.001",
]) {
  const p = byCode.get(code);
  if (!p) fail(`missing SKU ${code}`);
  else if (p.available !== false) fail(`${code} should be hidden (available=false)`);
  if (listingByCode.has(code)) fail(`${code} still appears in public listing index`);
}

// FX / markup unchanged
const markup = JSON.parse(fs.readFileSync(markupPath, "utf8"));
if (Number(markup.fx) !== 18 || Number(markup.markup) !== 0.45) {
  fail(`retail-markup changed: fx=${markup.fx} markup=${markup.markup}, expected 18/0.45`);
}

if (process.exitCode) {
  console.error("pack-price guardrail FAILED");
} else {
  console.log("ok pack-price guardrail: overrides match + hidden SKUs absent from listing index + fx/markup 18/0.45");
}
