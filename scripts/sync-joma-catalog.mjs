#!/usr/bin/env node
/**
 * Refresh stock + real size runs from a Joma B2B export.
 *
 * Live portal login is not configured in-repo (no credentials).
 * This is the durable refresh path:
 *
 *   JOMA_CATALOG_JSON=/path/to/export.json npm run sync:joma -- --write
 *
 * Export row shape (flexible):
 *   {
 *     code | sku | ref,
 *     qty | stock | stockQty,
 *     sizes: "S/M/L" | ["S","M"] | [{ size, stock }],
 *     available?: boolean
 *   }
 *
 * Writes data/size-master.json (authoritative size/stock overlay).
 * With --write-catalog, also patches matching rows in data/products.json
 * without inventing per-size counts.
 *
 * After a file write, runs scripts/sync-stock-db.mjs so Supabase stock matches
 * the baked catalog. A database failure is printed and does not undo the files
 * or change this script's exit code, so the morning commit can still proceed.
 * Set SKIP_STOCK_DB_SYNC=1 to write files only.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const catalogPath = path.join(root, "data", "products.json");
const masterPath = path.join(root, "data", "size-master.json");
const sourcePath = path.join(root, "data", "products-source.json");
const dumpPath = process.env.JOMA_CATALOG_JSON;
const write = process.argv.includes("--write") || process.argv.includes("--write-catalog");
const writeCatalog = process.argv.includes("--write-catalog");

function syncDatabaseAfterFileWrite() {
  if (!write) return;
  if (process.env.SKIP_STOCK_DB_SYNC === "1") {
    console.error("STOCK DB SYNC SKIPPED (SKIP_STOCK_DB_SYNC=1).");
    return;
  }
  const script = path.join(root, "scripts", "sync-stock-db.mjs");
  const result = spawnSync(process.execPath, [script], {
    stdio: "inherit",
    env: process.env,
  });
  if (result.error || result.status !== 0) {
    console.error(
      "STOCK DB SYNC FAILED. Catalog files were still written, so the file commit can proceed. Re-run `npm run sync:stock-db` when Supabase is reachable.",
    );
  }
}

function parseSizes(value) {
  if (!value) return { sizes: [], perSize: null };
  if (Array.isArray(value)) {
    if (value.length && typeof value[0] === "object" && value[0] && "size" in value[0]) {
      const perSize = {};
      const sizes = [];
      for (const row of value) {
        const size = String(row.size ?? row.name ?? "").trim();
        if (!size) continue;
        sizes.push(size);
        const n = Number(row.stock ?? row.qty);
        if (Number.isFinite(n)) perSize[size] = Math.max(0, n);
      }
      return { sizes, perSize: Object.keys(perSize).length ? perSize : null };
    }
    return { sizes: value.map(String).map((s) => s.trim()).filter(Boolean), perSize: null };
  }
  const sizes = String(value)
    .split(/[\/|,]/)
    .map((s) => s.trim())
    .filter(Boolean);
  return { sizes, perSize: null };
}

function loadMaster() {
  if (!fs.existsSync(masterPath)) return {};
  return JSON.parse(fs.readFileSync(masterPath, "utf8"));
}

function seedFromOpeningSheet(master) {
  if (!fs.existsSync(sourcePath)) return master;
  const src = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
  for (const row of src) {
    if (master[row.code]) continue;
    const { sizes } = parseSizes(row.sizes);
    master[row.code] = {
      sizes: sizes.length ? sizes : ["ONE"],
      qty: Number(row.qty || 0),
      perSize: null,
    };
  }
  return master;
}

if (!dumpPath) {
  const master = seedFromOpeningSheet(loadMaster());
  if (write) {
    fs.writeFileSync(masterPath, JSON.stringify(master, null, 2) + "\n");
  }
  console.log(
    JSON.stringify(
      {
        status: "ready-without-live-login",
        reason:
          "No JOMA_CATALOG_JSON. Live Joma B2B login is not configured. Stock/sizes come from imported masters + data/size-master.json.",
        sizeMasterKeys: Object.keys(master).length,
        next: [
          "Export B2B rows (code, sizes, qty or per-size stock)",
          "JOMA_CATALOG_JSON=export.json npm run sync:joma -- --write",
        ],
      },
      null,
      2,
    ),
  );
  syncDatabaseAfterFileWrite();
  process.exit(0);
}

const dump = JSON.parse(fs.readFileSync(dumpPath, "utf8"));
const rows = Array.isArray(dump) ? dump : dump.products || dump.items || [];
const master = seedFromOpeningSheet(loadMaster());
let matched = 0;
let sized = 0;
let oos = 0;

for (const row of rows) {
  const code = String(row.code || row.sku || row.ref || "").trim();
  if (!code) continue;
  matched += 1;
  const { sizes, perSize } = parseSizes(row.sizes || row.size_run || row.sizeOptions);
  const qty = Number(row.qty ?? row.stock ?? row.stockQty);
  const available = row.available;
  let nextQty = Number.isFinite(qty) ? Math.max(0, qty) : master[code]?.qty;
  if (available === false) {
    nextQty = 0;
    oos += 1;
  }
  if (sizes.length) sized += 1;
  master[code] = {
    sizes: sizes.length ? sizes : master[code]?.sizes || [],
    qty: nextQty ?? 0,
    perSize: perSize || master[code]?.perSize || null,
  };
}

if (write) {
  fs.writeFileSync(masterPath, JSON.stringify(master, null, 2) + "\n");
}

let catalogPatched = 0;
if (writeCatalog && fs.existsSync(catalogPath)) {
  const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
  for (const product of catalog) {
    const row = master[product.code];
    if (!row) continue;
    catalogPatched += 1;
    if (Number.isFinite(row.qty)) {
      product.stockQty = row.qty;
      product.totalQty = row.qty;
    }
    if (row.sizes?.length) {
      product.sizeOptions = row.sizes;
      product.sizes = row.sizes.map((size) => ({
        size,
        stock:
          row.perSize && row.perSize[size] != null
            ? row.perSize[size]
            : row.qty > 0
              ? row.qty
              : 0,
      }));
    }
  }
  fs.writeFileSync(catalogPath, JSON.stringify(catalog));
}

console.log(
  JSON.stringify(
    {
      matched,
      sized,
      oosMarked: oos,
      masterKeys: Object.keys(master).length,
      wroteMaster: write,
      catalogPatched: writeCatalog ? catalogPatched : 0,
    },
    null,
    2,
  ),
);
syncDatabaseAfterFileWrite();
