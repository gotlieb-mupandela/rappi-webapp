#!/usr/bin/env node
/**
 * Recalculate catalog NAD prices from 67% markup → 45% markup.
 *
 * Formula (same as B2B import):
 *   NAD = round(EUR_cost × 18 × (1 + markup))
 *
 * Usage:
 *   node scripts/reprice-markup.mjs              # dry-run preview only
 *   node scripts/reprice-markup.mjs --write      # apply to data/products.json
 *   node scripts/reprice-markup.mjs --write --bake  # also refresh listing-index
 *
 * Skips: price 0, fixed bib packs (101686.* @ N$900), DPO-TEST.
 * Prefer opening-sheet EUR from data/products-source.json when present;
 * otherwise recover EUR = NAD / (18 × 1.67).
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = path.resolve(import.meta.dirname, "..");
const catalogPath = path.join(root, "data", "products.json");
const sourcePath = path.join(root, "data", "products-source.json");
const statePath = path.join(root, "data", "retail-markup.json");
const previewPath = path.join(root, "tmp", "reprice-67-to-45-preview.json");
const csvPath = path.join(root, "tmp", "reprice-67-to-45-preview.csv");
const backupPath = path.join(root, "tmp", "products-before-reprice-45.json");

const FX = 18;
const OLD_MARKUP = 0.67;
const NEW_MARKUP = 0.45;
const WRITE = process.argv.includes("--write");
const BAKE = process.argv.includes("--bake");
const FORCE = process.argv.includes("--force");

function retailFromEur(eur, markup) {
  return Math.round(eur * FX * (1 + markup));
}

function eurFromMarkupNad(nad, markup) {
  return nad / (FX * (1 + markup));
}

function isBibFixed(code, price) {
  return /^101686\./i.test(code) && price === 900;
}

function isDpoTest(code) {
  return /^DPO[-_]?TEST$/i.test(code);
}

function readMarkupState() {
  if (!fs.existsSync(statePath)) return { markup: OLD_MARKUP, fx: FX };
  try {
    return JSON.parse(fs.readFileSync(statePath, "utf8"));
  } catch {
    return { markup: OLD_MARKUP, fx: FX };
  }
}

const state = readMarkupState();
if (!FORCE && Math.abs(Number(state.markup) - NEW_MARKUP) < 1e-9) {
  console.error(
    `Catalog already at ${(NEW_MARKUP * 100).toFixed(0)}% markup (${statePath}). Use --force to recalculate anyway.`,
  );
  process.exit(0);
}

const fromMarkup = FORCE
  ? OLD_MARKUP
  : Number(state.markup) || OLD_MARKUP;
if (!FORCE && Math.abs(fromMarkup - OLD_MARKUP) > 1e-9) {
  console.error(
    `Refusing to reprice from markup ${fromMarkup} (expected ${OLD_MARKUP}). Use --force if intentional.`,
  );
  process.exit(1);
}

const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
const source = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
const sourceEur = new Map(
  (Array.isArray(source) ? source : []).map((row) => [row.code, Number(row.price)]),
);

const changes = [];
const skipped = { zero: 0, bib: 0, dpo: 0, unchanged: 0 };
let fromSource = 0;
let fromRecovered = 0;

for (const product of catalog) {
  const oldPrice = Number(product.price) || 0;
  const code = product.code;

  if (oldPrice <= 0) {
    skipped.zero += 1;
    continue;
  }
  if (isBibFixed(code, oldPrice)) {
    skipped.bib += 1;
    continue;
  }
  if (isDpoTest(code)) {
    skipped.dpo += 1;
    continue;
  }

  const sheetEur = sourceEur.get(code);
  let eur;
  let base = "recovered";
  if (sheetEur != null && sheetEur > 0) {
    const expectedOld = retailFromEur(sheetEur, OLD_MARKUP);
    const expectedNew = retailFromEur(sheetEur, NEW_MARKUP);
    if (oldPrice === expectedNew) {
      skipped.unchanged += 1;
      continue;
    }
    if (oldPrice === expectedOld) {
      eur = sheetEur;
      base = "source";
      fromSource += 1;
    } else {
      eur = eurFromMarkupNad(oldPrice, fromMarkup);
      fromRecovered += 1;
    }
  } else {
    eur = eurFromMarkupNad(oldPrice, fromMarkup);
    fromRecovered += 1;
  }

  const newPrice = retailFromEur(eur, NEW_MARKUP);
  if (newPrice === oldPrice) {
    skipped.unchanged += 1;
    continue;
  }

  changes.push({
    id: product.id,
    code,
    name: product.displayName || product.name || product.title,
    eurCost: Math.round(eur * 10000) / 10000,
    base,
    oldPrice,
    newPrice,
    delta: newPrice - oldPrice,
  });
}

fs.mkdirSync(path.dirname(previewPath), { recursive: true });
const summary = {
  dryRun: !WRITE,
  formula: {
    fx: FX,
    oldMarkup: OLD_MARKUP,
    newMarkup: NEW_MARKUP,
    old: "round(EUR × 18 × 1.67)",
    next: "round(EUR × 18 × 1.45)",
  },
  catalogSize: catalog.length,
  wouldChange: changes.length,
  fromSource,
  fromRecovered,
  skipped,
  sample: changes.slice(0, 25),
  generatedAt: new Date().toISOString(),
};

fs.writeFileSync(previewPath, JSON.stringify({ ...summary, changes }, null, 2));
fs.writeFileSync(
  csvPath,
  [
    "id,code,name,eur_cost,base,old_price,new_price,delta",
    ...changes.map((row) =>
      [
        row.id,
        row.code,
        JSON.stringify(row.name),
        row.eurCost,
        row.base,
        row.oldPrice,
        row.newPrice,
        row.delta,
      ].join(","),
    ),
  ].join("\n"),
);

console.log(JSON.stringify(summary, null, 2));
console.log(`\nPreview JSON: ${previewPath}`);
console.log(`Preview CSV:  ${csvPath}`);

if (!WRITE) {
  console.log("\nDry-run only. Re-run with --write to apply.");
  process.exit(0);
}

fs.copyFileSync(catalogPath, backupPath);
console.log(`Backup: ${backupPath}`);

const byId = new Map(changes.map((row) => [row.id, row]));
const next = catalog.map((product) => {
  const change = byId.get(product.id);
  if (!change) return product;
  return { ...product, price: change.newPrice, unitPrice: change.newPrice };
});
fs.writeFileSync(catalogPath, `${JSON.stringify(next)}\n`);
fs.writeFileSync(
  statePath,
  `${JSON.stringify({ markup: NEW_MARKUP, fx: FX, updatedAt: new Date().toISOString() }, null, 2)}\n`,
);
console.log(`Updated ${changes.length} products in data/products.json`);
console.log(`Markup state → ${statePath}`);

if (BAKE) {
  console.log("Baking listing index…");
  const baked = spawnSync("npx", ["tsx", "scripts/bake-catalog.ts"], {
    cwd: root,
    stdio: "inherit",
    shell: true,
  });
  if (baked.status !== 0) process.exit(baked.status ?? 1);
}
