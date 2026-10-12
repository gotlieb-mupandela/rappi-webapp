import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  applyStockPlan,
  batchCount,
  fetchDbStock,
  loadRepoProducts,
  planStockSync,
  revalidateConfig,
  revalidateStorefrontCatalog,
  runStockSync,
} from "./sync-stock-db.mjs";

function product(code, stockQty, available, sizes, id = code) {
  return { id, code, stockQty, available, sizes };
}

function dbProduct(id, code, stock_qty, available) {
  return { id, code, stock_qty, available };
}

test("copies repo stock and leaves matching rows alone", () => {
  const repo = [
    product("A", 5, true, [
      { size: "S", stock: 2 },
      { size: "M", stock: 3 },
    ]),
    product("B", 4, true, [{ size: "ONE", stock: 4 }]),
  ];
  const dbProducts = [
    dbProduct("id-a", "A", 9, true),
    dbProduct("id-b", "B", 4, true),
  ];
  const dbSizes = [
    { product_id: "id-a", size: "S", stock: 9 },
    { product_id: "id-a", size: "XL", stock: 2 },
    { product_id: "id-b", size: "ONE", stock: 4 },
  ];
  const plan = planStockSync(repo, dbProducts, dbSizes);
  assert.equal(plan.counts.differing, 1);
  assert.equal(plan.counts.compared, 2);
  assert.deepEqual(plan.sizeWrites, [
    { product_id: "id-a", size: "S", stock: 2 },
    { product_id: "id-a", size: "M", stock: 3 },
    { product_id: "id-a", size: "XL", stock: 0 },
  ]);
  assert.equal(plan.counts.sizeUpserts, 2);
  assert.equal(plan.counts.sizeZeros, 1);
  assert.deepEqual(plan.productWrites, []);
  assert.equal(plan.counts.stockQtyUpdates, 0);
});

test("keeps pack-policy hidden SKUs unavailable", () => {
  const repo = [product("PACK", 73, false, [{ size: "ONE SIZE", stock: 73 }])];
  const already = planStockSync(
    repo,
    [dbProduct("id-pack", "PACK", 73, false)],
    [{ product_id: "id-pack", size: "ONE SIZE", stock: 73 }],
  );
  assert.equal(already.counts.differing, 0);
  assert.equal(already.productWrites.length, 0);

  const drifted = planStockSync(
    repo,
    [dbProduct("id-pack", "PACK", 73, true)],
    [{ product_id: "id-pack", size: "ONE SIZE", stock: 73 }],
  );
  assert.deepEqual(drifted.sizeWrites, []);
  assert.deepEqual(drifted.productWrites, [{ id: "id-pack", available: false }]);
  assert.equal(drifted.counts.availableUpdates, 1);
  assert.equal(drifted.counts.stockQtyUpdates, 0);
});

test("writes stock_qty when the size sum would not match the repo", () => {
  const repo = [product("C", 10, true, [{ size: "S", stock: 4 }])];
  const plan = planStockSync(
    repo,
    [dbProduct("id-c", "C", 4, true)],
    [{ product_id: "id-c", size: "S", stock: 4 }],
  );
  assert.deepEqual(plan.sizeWrites, []);
  assert.deepEqual(plan.productWrites, [{ id: "id-c", stock_qty: 10 }]);
});

test("does not insert repo products missing from the database or touch database-only products", () => {
  const plan = planStockSync(
    [product("NEW", 3, true, [{ size: "S", stock: 3 }])],
    [dbProduct("id-old", "OLD", 8, true)],
    [{ product_id: "id-old", size: "S", stock: 8 }],
  );
  assert.equal(plan.counts.unmatchedRepo, 1);
  assert.deepEqual(plan.unmatchedRepoSample, ["NEW"]);
  assert.equal(plan.counts.dbOnlyUntouched, 1);
  assert.equal(plan.sizeWrites.length, 0);
  assert.equal(plan.productWrites.length, 0);
});

test("a second plan after the writes is empty", () => {
  const repo = [
    product("A", 5, false, [
      { size: "S", stock: 5 },
      { size: "M", stock: 0 },
    ]),
  ];
  const dbProducts = [dbProduct("id-a", "A", 2, true)];
  const dbSizes = [
    { product_id: "id-a", size: "S", stock: 2 },
    { product_id: "id-a", size: "L", stock: 1 },
  ];
  const plan = planStockSync(repo, dbProducts, dbSizes);
  assert.ok(plan.counts.differing > 0);

  const nextProducts = dbProducts.map((row) => ({ ...row, stock_qty: 5, available: false }));
  const nextSizes = [
    { product_id: "id-a", size: "S", stock: 5 },
    { product_id: "id-a", size: "M", stock: 0 },
    { product_id: "id-a", size: "L", stock: 0 },
  ];
  const again = planStockSync(repo, nextProducts, nextSizes);
  assert.equal(again.counts.differing, 0);
  assert.equal(again.sizeWrites.length, 0);
  assert.equal(again.productWrites.length, 0);
});

test("dry-run reads stock and does not call the write RPC or revalidate", async () => {
  const pages = {
    products: [dbProduct("id-a", "A", 1, true)],
    product_sizes: [{ product_id: "id-a", size: "S", stock: 1 }],
  };
  const calls = [];
  const supabase = fakeSupabase(pages, calls);
  let revalidated = false;
  const result = await runStockSync({
    supabase,
    repoProducts: [product("A", 4, true, [{ size: "S", stock: 4 }])],
    dryRun: true,
    pageSize: 2,
    revalidate: async () => {
      revalidated = true;
      return { skipped: false };
    },
  });
  assert.equal(result.wrote, false);
  assert.equal(result.revalidate.reason, "dry-run");
  assert.equal(revalidated, false);
  assert.equal(calls.length, 0);
  assert.equal(result.summary.differing, 1);
  assert.equal(result.summary.dryRun, true);
});

test("apply sends sizes before product columns, in batches of 400", async () => {
  const sizeWrites = Array.from({ length: 401 }, (_, i) => ({
    product_id: "id-a",
    size: `S${i}`,
    stock: i,
  }));
  const productWrites = [{ id: "id-a", stock_qty: 3, available: true }];
  const calls = [];
  const supabase = {
    rpc: async (name, args) => {
      calls.push({ name, args });
      return { data: { sizes: args.p_sizes.length, products: args.p_products.length }, error: null };
    },
  };
  await applyStockPlan(supabase, { sizeWrites, productWrites });
  assert.equal(calls.length, 3);
  assert.equal(calls[0].name, "apply_repo_stock_batch");
  assert.equal(calls[0].args.p_sizes.length, 400);
  assert.deepEqual(calls[0].args.p_products, []);
  assert.equal(calls[1].args.p_sizes.length, 1);
  assert.equal(calls[2].args.p_sizes.length, 0);
  assert.deepEqual(calls[2].args.p_products, productWrites);
  assert.equal(batchCount({ sizeWrites, productWrites }), 3);
});

test("a failed batch throws and does not revalidate", async () => {
  const pages = {
    products: [dbProduct("id-a", "A", 1, true)],
    product_sizes: [{ product_id: "id-a", size: "S", stock: 1 }],
  };
  const supabase = fakeSupabase(pages, [], {
    error: { message: "fetch failed" },
  });
  await assert.rejects(
    () =>
      runStockSync({
        supabase,
        repoProducts: [product("A", 2, true, [{ size: "S", stock: 2 }])],
        dryRun: false,
        revalidate: async () => {
          throw new Error("revalidate should not run");
        },
      }),
    /Stock database batch failed: fetch failed/,
  );
});

test("revalidate is skipped unless the secret and base URL are both set", async () => {
  assert.equal(revalidateConfig({}), null);
  assert.equal(
    revalidateConfig({ CATALOG_REVALIDATE_SECRET: "s", NEXT_PUBLIC_SITE_URL: "" }),
    null,
  );
  assert.deepEqual(
    revalidateConfig({
      CATALOG_REVALIDATE_SECRET: "top-secret",
      CATALOG_REVALIDATE_URL: "https://www.rappisportshub.com/",
    }),
    {
      secret: "top-secret",
      url: "https://www.rappisportshub.com/api/catalog/revalidate",
    },
  );

  const skipped = await revalidateStorefrontCatalog({ NEXT_PUBLIC_SITE_URL: "https://example.com" });
  assert.equal(skipped.skipped, true);

  let seen;
  const ok = await revalidateStorefrontCatalog(
    {
      CATALOG_REVALIDATE_SECRET: "top-secret",
      NEXT_PUBLIC_SITE_URL: "https://www.rappisportshub.com",
    },
    async (url, init) => {
      seen = { url, init };
      return { ok: true, status: 200, text: async () => "" };
    },
  );
  assert.equal(ok.skipped, false);
  assert.equal(seen.url, "https://www.rappisportshub.com/api/catalog/revalidate");
  assert.equal(seen.init.headers.authorization, "Bearer top-secret");
  assert.equal(seen.init.method, "POST");
});

test("pages product and size reads and surfaces an unreachable database", async () => {
  const products = Array.from({ length: 3 }, (_, i) => dbProduct(`id-${i}`, `C${i}`, i, true));
  const sizes = products.map((row) => ({ product_id: row.id, size: "S", stock: row.stock_qty }));
  const loaded = await fetchDbStock(fakeSupabase({ products, product_sizes: sizes }), 2);
  assert.equal(loaded.products.length, 3);
  assert.equal(loaded.sizes.length, 3);

  await assert.rejects(
    () => fetchDbStock(fakeSupabase({ products, product_sizes: sizes }, [], null, "products")),
    /Could not read public.products/,
  );
});

test("a real run with nothing to write still revalidates", async () => {
  const pages = {
    products: [dbProduct("id-a", "A", 4, true)],
    product_sizes: [{ product_id: "id-a", size: "S", stock: 4 }],
  };
  const calls = [];
  const result = await runStockSync({
    supabase: fakeSupabase(pages, calls),
    repoProducts: [product("A", 4, true, [{ size: "S", stock: 4 }])],
    dryRun: false,
    revalidate: async () => ({ skipped: false }),
  });
  assert.equal(result.wrote, true);
  assert.equal(result.summary.differing, 0);
  assert.equal(result.revalidate.skipped, false);
  assert.equal(calls.length, 0);
});

test("migration assigns only stock_qty and available", () => {
  const sql = fs.readFileSync(
    path.join(import.meta.dirname, "..", "supabase/migrations/20261011181000_apply_repo_stock_batch.sql"),
    "utf8",
  );
  const update = sql.split("update public.products")[1].split("get diagnostics product_count")[0];
  assert.match(update, /stock_qty/);
  assert.match(update, /available/);
  for (const column of [
    "price",
    "unit_price",
    "pack_size",
    "display_name",
    "image_url",
    "images",
    "content_changed_at",
    "title",
    "description",
  ]) {
    assert.equal(update.includes(column), false, column);
  }
});

test("the baked catalog matches a database built from the same file", () => {
  const repo = loadRepoProducts();
  const dbProducts = repo.map((row) => ({
    id: row.id,
    code: row.code,
    stock_qty: row.stockQty,
    available: row.available !== false,
  }));
  const dbSizes = repo.flatMap((row) =>
    (row.sizes ?? []).map((size) => ({
      product_id: row.id,
      size: size.size,
      stock: size.stock,
    })),
  );
  const plan = planStockSync(repo, dbProducts, dbSizes);
  assert.equal(plan.counts.compared, repo.length);
  assert.equal(plan.counts.unmatchedRepo, 0);
  assert.equal(plan.counts.differing, 0);
  assert.equal(plan.sizeWrites.length, 0);
  assert.equal(plan.productWrites.length, 0);

  const drifted = structuredClone(dbProducts);
  const hidden = drifted.find((row) => row.stock_qty > 0 && row.available === false);
  assert.ok(hidden);
  hidden.available = true;
  const driftedSizes = dbSizes.map((row) =>
    row.product_id === hidden.id ? { ...row, stock: row.stock + 1 } : row,
  );
  const fix = planStockSync(repo, drifted, driftedSizes);
  assert.equal(fix.counts.differing, 1);
  assert.equal(fix.productWrites.some((row) => row.available === false), true);
  assert.equal(fix.productWrites.some((row) => "price" in row || "unit_price" in row), false);
  assert.ok(fix.sizeWrites.every((row) => row.product_id === hidden.id));
});

test("refuses a payload that names a merchandising column", async () => {
  const supabase = {
    rpc: async () => {
      throw new Error("rpc should not be called");
    },
  };
  await assert.rejects(
    () => applyStockPlan(supabase, { sizeWrites: [], productWrites: [{ id: "x", price: 1 }] }),
    /forbidden column "price"/,
  );
});

function fakeSupabase(pages, calls = [], rpcResult = { error: null }, failTable = "") {
  return {
    from(table) {
      const state = { table };
      const api = {
        select() {
          return api;
        },
        order() {
          return api;
        },
        async range(from, to) {
          if (failTable && table === failTable) {
            return { data: null, error: { message: "connect ECONNREFUSED" } };
          }
          const rows = pages[table] ?? [];
          return { data: rows.slice(from, to + 1), error: null };
        },
      };
      return api;
    },
    rpc: async (name, args) => {
      calls.push({ name, args });
      return { data: null, ...rpcResult };
    },
  };
}
