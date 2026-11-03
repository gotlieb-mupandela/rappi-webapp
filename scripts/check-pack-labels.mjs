#!/usr/bin/env node
/**
 * Fails when a pack in data/apparel-assortments.json does not resolve to a
 * pack in the catalog, or when a product has a single S01-S99 style size and
 * no pack label unless it is listed in data/non-pack-allowlist.json.
 */
import fs from "node:fs";
import path from "node:path";
import {
  apparelAssortmentsPath,
  catalogPath,
  loadAllowlist,
  missingAssortmentLabels,
  unlabelledStylePacks,
} from "./pack-label-guard.mjs";

const root = path.resolve(import.meta.dirname, "..");
const listingPath = path.join(root, "public", "listing-index.json");

function fail(message) {
  console.error(message);
  process.exitCode = 1;
}

const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
const apparel = JSON.parse(fs.readFileSync(apparelAssortmentsPath, "utf8"));
const allow = loadAllowlist();
const rows = apparel.products || [];

const problems = missingAssortmentLabels(catalog, rows);
if (problems.length) {
  fail(`Assortment rows that do not resolve to a pack (${problems.length}):`);
  for (const line of problems) fail(`  ${line}`);
}

const suspects = unlabelledStylePacks(catalog, allow);
if (suspects.length) {
  fail(`Unlabelled single style sizes S01-S99 (${suspects.length}):`);
  for (const row of suspects) fail(`  ${row.code}\tsize ${row.size}\t${row.name}`);
}

const listing = JSON.parse(fs.readFileSync(listingPath, "utf8"));
const listingByCode = new Map(listing.map((product) => [product.code, product]));
for (const row of rows) {
  const indexed = listingByCode.get(row.code);
  if (!indexed) {
    fail(`${row.code} assortment is missing from the public listing index`);
    continue;
  }
  if (indexed.sellAs !== "assortment" || indexed.packSize !== row.pack_size) {
    fail(
      `${row.code} listing is ${indexed.sellAs}/${indexed.packSize}, expected assortment/${row.pack_size}`,
    );
  }
}

if (process.exitCode) {
  console.error("pack-label check FAILED");
} else {
  console.log(
    `ok pack labels: ${rows.length} assortment rows resolve to packs, ${allow.length} single-size codes allowlisted`,
  );
}
