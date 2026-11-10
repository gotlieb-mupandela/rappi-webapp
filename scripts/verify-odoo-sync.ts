/**
 * Read-only check that Odoo matches the website catalog after a sync.
 *
 *   npm run odoo:verify
 *
 * For every sellable website product (same selection as the sync) it checks,
 * against Odoo:
 *   - each size variant exists, by internal reference "<code>-<size>" (or "<code>")
 *   - the sale price equals the website NAD price
 *   - on-hand stock in Odoo equals the website stock for that size
 *   - the product has a main image
 * It writes nothing to Odoo. A JSON report goes to tmp/odoo-sync/.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createOdooClient, odooConfigFromEnv, type OdooClient } from "../lib/odoo";
import type { Product } from "../lib/types";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

type Expected = { code: string; ref: string; price: number; stock: number | null };
type M2O = [number, string] | false;

function expectedVariants(): { variants: Expected[]; products: number } {
  const raw = JSON.parse(readFileSync(join(root, "data", "products.json"), "utf8")) as Product[];
  const variants: Expected[] = [];
  let products = 0;
  for (const p of raw) {
    if (p.code === "DPO-TEST" || p.available === false || !(p.price > 0)) continue;
    products += 1;
    const sizes = (p.sizes ?? []).map((s) => ({ size: s.size.trim(), stock: s.stock })).filter((s) => s.size);
    if (sizes.length > 1) {
      for (const s of sizes) {
        variants.push({
          code: p.code,
          ref: `${p.code}-${s.size}`,
          price: p.price,
          stock: Number.isFinite(s.stock) ? Math.max(0, s.stock) : null,
        });
      }
    } else {
      const stock = sizes.length === 1 ? sizes[0].stock : p.stockQty;
      variants.push({
        code: p.code,
        ref: p.code,
        price: p.price,
        stock: Number.isFinite(stock) ? Math.max(0, stock) : null,
      });
    }
  }
  return { variants, products };
}

/** Pages by id (id > last seen) rather than offset, which slows down on big tables. */
async function readAll<T extends { id: number }>(
  odoo: OdooClient,
  model: string,
  domain: unknown[],
  fields: string[],
  page = 1000,
) {
  const out: T[] = [];
  let lastId = 0;
  for (;;) {
    const rows = await odoo.searchRead<T>(model, [...domain, ["id", ">", lastId]], fields, {
      limit: page,
      order: "id",
      context: { active_test: false },
    });
    out.push(...rows);
    if (rows.length) lastId = rows[rows.length - 1].id;
    console.log(`  ${model}: ${out.length} read`);
    if (rows.length < page) break;
  }
  return out;
}

async function main() {
  const envFile = join(root, ".env.local");
  if (existsSync(envFile)) process.loadEnvFile(envFile);
  const odoo = createOdooClient(odooConfigFromEnv(), { timeoutMs: 180_000 });

  const { variants: expected, products } = expectedVariants();
  console.log(`Website: ${products} sellable products, ${expected.length} size variants.`);
  console.log("Reading Odoo (read-only)…");

  // Plain stored fields only: computed ones (qty_available, lst_price) are too
  // slow to read for tens of thousands of variants.
  const variantRows = await readAll<{ id: number; default_code: string | false; product_tmpl_id: M2O; active: boolean }>(
    odoo,
    "product.product",
    [["default_code", "!=", false]],
    ["default_code", "product_tmpl_id", "active"],
  );
  const templatePrice = new Map(
    (await readAll<{ id: number; list_price: number }>(odoo, "product.template", [], ["list_price"])).map((t) => [
      t.id,
      t.list_price,
    ]),
  );
  // Filter on the warehouse stock location ids directly: a join on
  // location_id.usage times out on Odoo Online once there are ~40k quants.
  const stockLocations = (
    await odoo.searchRead<{ id: number; lot_stock_id: M2O }>("stock.warehouse", [], ["lot_stock_id"])
  )
    .map((w) => (Array.isArray(w.lot_stock_id) ? w.lot_stock_id[0] : null))
    .filter((id): id is number => id !== null);
  const onHand = new Map<number, number>();
  for (const q of await readAll<{ id: number; product_id: M2O; quantity: number }>(
    odoo,
    "stock.quant",
    [["location_id", "child_of", stockLocations]],
    ["product_id", "quantity"],
    500,
  )) {
    const id = Array.isArray(q.product_id) ? q.product_id[0] : null;
    if (id !== null) onHand.set(id, (onHand.get(id) ?? 0) + q.quantity);
  }
  const rows = variantRows.map((v) => {
    const tmpl = Array.isArray(v.product_tmpl_id) ? v.product_tmpl_id[0] : -1;
    return { ...v, lst_price: templatePrice.get(tmpl) ?? NaN, qty_available: onHand.get(v.id) ?? 0 };
  });
  const byRef = new Map(rows.map((r) => [r.default_code as string, r]));

  const noImage = await readAll<{ id: number }>(
    odoo,
    "product.template",
    [["image_1920", "=", false]],
    ["id"],
  );
  const templatesWithoutImage = new Set(noImage.map((t) => t.id));

  const missing: string[] = [];
  const archived: string[] = [];
  const priceMismatch: Array<{ ref: string; site: number; odoo: number }> = [];
  const stockMismatch: Array<{ ref: string; site: number; odoo: number }> = [];
  const productsWithoutImage = new Set<string>();
  const productsMissing = new Set<string>();
  const productsMatched = new Set<string>();

  for (const e of expected) {
    const row = byRef.get(e.ref);
    if (!row) {
      missing.push(e.ref);
      productsMissing.add(e.code);
      continue;
    }
    if (!row.active) archived.push(e.ref);
    if (Math.abs(row.lst_price - e.price) > 0.004) priceMismatch.push({ ref: e.ref, site: e.price, odoo: row.lst_price });
    if (e.stock !== null && Math.abs(row.qty_available - e.stock) > 0.0001) {
      stockMismatch.push({ ref: e.ref, site: e.stock, odoo: row.qty_available });
    }
    const tmpl = Array.isArray(row.product_tmpl_id) ? row.product_tmpl_id[0] : null;
    if (tmpl !== null && templatesWithoutImage.has(tmpl)) productsWithoutImage.add(e.code);
  }
  for (const e of expected) if (!productsMissing.has(e.code)) productsMatched.add(e.code);

  const report = {
    checkedAt: new Date().toISOString(),
    website: { products, variants: expected.length },
    matched: { products: productsMatched.size, variants: expected.length - missing.length },
    missingVariants: missing,
    productsWithMissingVariants: [...productsMissing],
    archivedInOdoo: archived,
    priceMismatch,
    stockMismatch,
    productsWithoutImage: [...productsWithoutImage],
  };
  const outDir = join(root, "tmp", "odoo-sync");
  mkdirSync(outDir, { recursive: true });
  const outFile = join(outDir, `verify-${report.checkedAt.replace(/[:.]/g, "-")}.json`);
  writeFileSync(outFile, JSON.stringify(report, null, 2));

  const ok = (n: number) => (n === 0 ? "OK" : "CHECK");
  console.log("\n=== Odoo vs website ===");
  console.log(`Products fully present:   ${productsMatched.size} / ${products}  ${ok(products - productsMatched.size)}`);
  console.log(`Size variants present:    ${expected.length - missing.length} / ${expected.length}  ${ok(missing.length)}`);
  console.log(`Archived in Odoo:         ${archived.length}  ${ok(archived.length)}`);
  console.log(`Price mismatches:         ${priceMismatch.length}  ${ok(priceMismatch.length)}`);
  console.log(`Stock mismatches:         ${stockMismatch.length}  ${ok(stockMismatch.length)}`);
  console.log(`Products without a photo: ${productsWithoutImage.size}  ${ok(productsWithoutImage.size)}`);
  for (const r of missing.slice(0, 5)) console.log(`  missing ${r}`);
  for (const m of priceMismatch.slice(0, 5)) console.log(`  price ${m.ref}: site ${m.site}, Odoo ${m.odoo}`);
  for (const m of stockMismatch.slice(0, 5)) console.log(`  stock ${m.ref}: site ${m.site}, Odoo ${m.odoo}`);
  console.log(`\nFull report: ${outFile}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
