#!/usr/bin/env node
/**
 * Push baked catalog stock into Supabase, then bust the storefront cache.
 *
 * Source of truth is data/products.json (stockQty, available, sizes). That is
 * the catalog the listing overlay merges onto. Pack-policy rows keep
 * available: false even when stockQty > 0; this script copies that flag and
 * does not recompute it.
 *
 *   npm run sync:stock-db -- --dry-run    # read and print counts, write nothing
 *   npm run sync:stock-db                  # upsert differing stock only
 *
 * Writes, in batches of 400, only rows that differ:
 *   product_sizes (product_id, size, stock)  — repo sizes, DB-only sizes set to 0
 *   products.stock_qty                       — repo stockQty
 *   products.available                       — repo available
 * Never writes price, unit_price, pack_size, names, images, or content_changed_at.
 *
 * Uses the service role the same way as lib/supabase/admin.ts
 * (NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY). Safe to re-run.
 * Exits non-zero if Supabase is unreachable or a batch fails.
 *
 * After a successful write, POST /api/catalog/revalidate when both
 * CATALOG_REVALIDATE_SECRET and a base URL (CATALOG_REVALIDATE_URL, else
 * NEXT_PUBLIC_SITE_URL) are set.
 */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createClient } from "@supabase/supabase-js";

const root = path.resolve(import.meta.dirname, "..");
const catalogPath = path.join(root, "data", "products.json");

export const BATCH_SIZE = 400;
const PAGE_SIZE = 1000;
const MAX_ROWS = 500_000;

const PRODUCT_WRITE_KEYS = new Set(["id", "stock_qty", "available"]);
const SIZE_WRITE_KEYS = new Set(["product_id", "size", "stock"]);

export function createStockSyncClient(env = process.env) {
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase admin is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (same service-role key as lib/supabase/admin.ts).",
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function loadRepoProducts(filePath = catalogPath) {
  const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
  if (!Array.isArray(parsed)) throw new Error(`${filePath} must be a product array`);
  return parsed;
}

/** Missing `available` matches the storefront: hidden only when explicitly false. */
export function repoAvailable(product) {
  return product?.available !== false;
}

function stockNumber(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.round(n));
}

function assertKeys(row, allowed, label) {
  for (const key of Object.keys(row)) {
    if (!allowed.has(key)) {
      throw new Error(`${label} tried to write forbidden column "${key}"`);
    }
  }
}

export function chunk(list, size = BATCH_SIZE) {
  if (!Number.isInteger(size) || size < 1) throw new Error("invalid batch size");
  const batches = [];
  for (let i = 0; i < list.length; i += size) batches.push(list.slice(i, i + size));
  return batches;
}

/**
 * @param {Array<{code: string, stockQty?: number, available?: boolean, sizes?: Array<{size: string, stock: number}>}>} repoProducts
 * @param {Array<{id: string, code: string, stock_qty: number, available: boolean}>} dbProducts
 * @param {Array<{product_id: string, size: string, stock: number}>} dbSizes
 */
export function planStockSync(repoProducts, dbProducts, dbSizes) {
  const dbByCode = new Map();
  for (const row of dbProducts) {
    if (row?.code) dbByCode.set(String(row.code), row);
  }

  const sizesByProduct = new Map();
  for (const row of dbSizes) {
    if (!row?.product_id) continue;
    let sizes = sizesByProduct.get(row.product_id);
    if (!sizes) {
      sizes = new Map();
      sizesByProduct.set(row.product_id, sizes);
    }
    sizes.set(String(row.size), stockNumber(row.stock));
  }

  const sizeWrites = [];
  const productWrites = [];
  const unmatchedRepoSample = [];
  const counts = {
    repoProducts: repoProducts.length,
    dbProducts: dbProducts.length,
    compared: 0,
    differing: 0,
    sizeUpserts: 0,
    sizeZeros: 0,
    stockQtyUpdates: 0,
    availableUpdates: 0,
    unmatchedRepo: 0,
    dbOnlyUntouched: 0,
  };

  const seenCodes = new Set();

  for (const product of repoProducts) {
    const code = String(product?.code ?? "").trim();
    if (!code || seenCodes.has(code)) continue;
    seenCodes.add(code);
    const db = dbByCode.get(code);
    if (!db?.id) {
      counts.unmatchedRepo += 1;
      if (unmatchedRepoSample.length < 20) unmatchedRepoSample.push(code);
      continue;
    }
    counts.compared += 1;

    const repoStock = stockNumber(product.stockQty);
    const available = repoAvailable(product);
    const dbSizeMap = sizesByProduct.get(db.id) ?? new Map();
    const repoSizeMap = new Map();
    for (const row of product.sizes ?? []) {
      const size = String(row?.size ?? "").trim();
      if (!size) continue;
      repoSizeMap.set(size, stockNumber(row.stock));
    }

    let finalSum = 0;
    const productSizeWrites = [];
    for (const [size, stock] of repoSizeMap) {
      finalSum += stock;
      const current = dbSizeMap.get(size);
      if (current === undefined || current !== stock) {
        productSizeWrites.push({ product_id: db.id, size, stock, kind: "upsert" });
      }
    }
    for (const [size, stock] of dbSizeMap) {
      if (repoSizeMap.has(size) || stock === 0) continue;
      productSizeWrites.push({ product_id: db.id, size, stock: 0, kind: "zero" });
    }

    const dbStock = stockNumber(db.stock_qty);
    const dbAvailable = db.available !== false;
    const sizeChanged = productSizeWrites.length > 0;
    // Size writes fire sync_product_stock(), which sets stock_qty to the sum.
    // DB-only sizes are zeroed, so that sum is the repo size sum.
    const stockAfterSizes = sizeChanged ? finalSum : dbStock;
    const needsStock = stockAfterSizes !== repoStock;
    const needsAvailable = dbAvailable !== available;
    if (!sizeChanged && !needsStock && !needsAvailable) continue;

    counts.differing += 1;
    for (const write of productSizeWrites) {
      if (write.kind === "zero") counts.sizeZeros += 1;
      else counts.sizeUpserts += 1;
      const row = { product_id: write.product_id, size: write.size, stock: write.stock };
      assertKeys(row, SIZE_WRITE_KEYS, "size");
      sizeWrites.push(row);
    }
    if (needsStock || needsAvailable) {
      const row = { id: db.id };
      if (needsStock) {
        row.stock_qty = repoStock;
        counts.stockQtyUpdates += 1;
      }
      if (needsAvailable) {
        row.available = available;
        counts.availableUpdates += 1;
      }
      assertKeys(row, PRODUCT_WRITE_KEYS, "product");
      productWrites.push(row);
    }
  }

  for (const row of dbProducts) {
    if (!seenCodes.has(String(row.code))) counts.dbOnlyUntouched += 1;
  }

  return { sizeWrites, productWrites, counts, unmatchedRepoSample };
}

export function batchCount(plan, batchSize = BATCH_SIZE) {
  return chunk(plan.sizeWrites, batchSize).length + chunk(plan.productWrites, batchSize).length;
}

async function fetchAll(supabase, table, columns, orderColumns, pageSize) {
  const rows = [];
  for (let from = 0; ; from += pageSize) {
    let query = supabase.from(table).select(columns);
    for (const column of orderColumns) query = query.order(column);
    const { data, error } = await query.range(from, from + pageSize - 1);
    if (error) throw new Error(`Could not read public.${table}: ${error.message}`);
    const page = data ?? [];
    rows.push(...page);
    if (rows.length > MAX_ROWS) {
      throw new Error(`Refusing to page public.${table} past ${MAX_ROWS} rows`);
    }
    if (page.length < pageSize) break;
  }
  return rows;
}

export async function fetchDbStock(supabase, pageSize = PAGE_SIZE) {
  if (!Number.isInteger(pageSize) || pageSize < 1) throw new Error("invalid page size");
  const [products, sizes] = await Promise.all([
    fetchAll(supabase, "products", "id, code, stock_qty, available", ["id"], pageSize),
    fetchAll(
      supabase,
      "product_sizes",
      "product_id, size, stock",
      ["product_id", "size"],
      pageSize,
    ),
  ]);
  return { products, sizes };
}

function rpcFailure(error) {
  const missing = /apply_repo_stock_batch|schema cache|Could not find the function/i.test(
    error.message ?? "",
  );
  const hint = missing
    ? " Apply supabase/migrations/20261011181000_apply_repo_stock_batch.sql on the RappiSport project, then re-run."
    : "";
  throw new Error(`Stock database batch failed: ${error.message}.${hint}`);
}

export async function applyStockPlan(supabase, plan, batchSize = BATCH_SIZE) {
  for (const batch of chunk(plan.sizeWrites, batchSize)) {
    for (const row of batch) assertKeys(row, SIZE_WRITE_KEYS, "size");
    const { error } = await supabase.rpc("apply_repo_stock_batch", {
      p_sizes: batch,
      p_products: [],
    });
    if (error) rpcFailure(error);
  }
  for (const batch of chunk(plan.productWrites, batchSize)) {
    for (const row of batch) assertKeys(row, PRODUCT_WRITE_KEYS, "product");
    const { error } = await supabase.rpc("apply_repo_stock_batch", {
      p_sizes: [],
      p_products: batch,
    });
    if (error) rpcFailure(error);
  }
}

export function revalidateConfig(env = process.env) {
  const secret = (env.CATALOG_REVALIDATE_SECRET ?? "").trim();
  const base = (env.CATALOG_REVALIDATE_URL || env.NEXT_PUBLIC_SITE_URL || "")
    .trim()
    .replace(/\/$/, "");
  if (!secret || !base) return null;
  return { secret, url: `${base}/api/catalog/revalidate` };
}

export async function revalidateStorefrontCatalog(env = process.env, fetchImpl = fetch) {
  const config = revalidateConfig(env);
  if (!config) {
    return { skipped: true, reason: "CATALOG_REVALIDATE_SECRET or base URL is not set" };
  }
  const response = await fetchImpl(config.url, {
    method: "POST",
    headers: { authorization: `Bearer ${config.secret}` },
  });
  if (!response.ok) {
    const body = typeof response.text === "function" ? await response.text() : "";
    throw new Error(
      `Catalog revalidate failed (${response.status}): ${String(body).slice(0, 300)}`,
    );
  }
  return { skipped: false, url: config.url };
}

export async function runStockSync({
  supabase,
  repoProducts,
  dryRun = false,
  batchSize = BATCH_SIZE,
  pageSize = PAGE_SIZE,
  revalidate,
}) {
  const db = await fetchDbStock(supabase, pageSize);
  const plan = planStockSync(repoProducts, db.products, db.sizes);
  const summary = {
    dryRun,
    ...plan.counts,
    batches: batchCount(plan, batchSize),
    unmatchedRepoSample: plan.unmatchedRepoSample,
  };
  if (dryRun) {
    return { summary, wrote: false, revalidate: { skipped: true, reason: "dry-run" } };
  }
  await applyStockPlan(supabase, plan, batchSize);
  const revalidateResult = revalidate
    ? await revalidate()
    : { skipped: true, reason: "not requested" };
  return { summary, wrote: true, revalidate: revalidateResult };
}

export async function main(argv = process.argv, env = process.env) {
  const dryRun = argv.includes("--dry-run");
  const supabase = createStockSyncClient(env);
  const repoProducts = loadRepoProducts();
  const result = await runStockSync({
    supabase,
    repoProducts,
    dryRun,
    revalidate: dryRun ? null : () => revalidateStorefrontCatalog(env),
  });
  console.log(JSON.stringify({ ...result.summary, wrote: result.wrote, revalidate: result.revalidate }, null, 2));
  return result;
}

function isDirectRun() {
  const entry = process.argv[1];
  if (!entry) return false;
  return import.meta.url === pathToFileURL(entry).href;
}

if (isDirectRun()) {
  main().catch((err) => {
    console.error("STOCK DB SYNC FAILED");
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
