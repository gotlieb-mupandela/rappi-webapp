/**
 * Sync website products (data/products.json) into Odoo as product.template.
 *
 *   npm run odoo:sync                       # DRY RUN: reads Odoo, changes nothing
 *   npm run odoo:sync -- --limit 5          # dry run for the first 5 products
 *   npm run odoo:sync -- --apply --limit 5  # write the first 5 products
 *   npm run odoo:sync -- --apply            # write everything
 *   npm run odoo:sync -- --apply --images   # also upload missing main images
 *
 * Options:
 *   --apply         write to Odoo (default is a dry run)
 *   --limit N       only the first N products (sorted by code)
 *   --offset N      skip the first N products (sorted by code)
 *   --codes a,b     only these product codes
 *   --images        upload the main image for templates that have none
 *   --images-only   only upload missing images; change nothing else
 *   --no-stock      do not touch stock quantities
 *   --parallel N    batches sent to Odoo at the same time (default 3, max 8)
 *
 * Mapping: one Odoo product.template per website SKU. Sizes become variants of
 * a "Size" attribute; each variant's internal reference is "<code>-<size>"
 * (a single-size product keeps "<code>"). Re-runs match on those references,
 * then on an exact, unique product name, so they never create duplicates.
 * Nothing in Odoo is ever deleted or archived.
 *
 * Env (from .env.local): ODOO_URL, ODOO_API_KEY, optional ODOO_DB.
 * The npm script preloads scripts/server-only-register.cjs so lib/odoo.ts's
 * "server-only" import resolves outside Next.js.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createOdooClient,
  odooConfigFromEnv,
  OdooConfigError,
  type OdooClient,
} from "../lib/odoo";
import type { Product } from "../lib/types";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const BATCH_SIZE = 25;
const WRITE_CONCURRENCY = 6;
const IMAGE_MAX_BYTES = 8 * 1024 * 1024;
const SIZE_ATTRIBUTE = "Size";

/** Keep chatter, followers and tracking messages out of bulk writes. */
const QUIET = {
  tracking_disable: true,
  mail_create_nolog: true,
  mail_create_nosubscribe: true,
  mail_notrack: true,
  active_test: false,
};

// ---------------------------------------------------------------------------
// CLI

type Options = {
  apply: boolean;
  limit?: number;
  offset: number;
  codes?: Set<string>;
  images: boolean;
  /** Only upload missing images for products already in Odoo; change nothing else. */
  imagesOnly?: boolean;
  stock: boolean;
  parallel: number;
};

function parseArgs(argv: string[]): Options {
  const opts: Options = { apply: false, offset: 0, images: false, stock: true, parallel: 3 };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = () => {
      const value = argv[++i];
      if (value === undefined) throw new Error(`${arg} needs a value`);
      return value;
    };
    if (arg === "--apply") opts.apply = true;
    else if (arg === "--images") opts.images = true;
    else if (arg === "--images-only") {
      opts.images = true;
      opts.imagesOnly = true;
    }
    else if (arg === "--no-stock") opts.stock = false;
    else if (arg === "--limit") opts.limit = positiveInt(next(), arg);
    else if (arg === "--offset") opts.offset = positiveInt(next(), arg, true);
    else if (arg === "--parallel") opts.parallel = Math.min(8, positiveInt(next(), arg));
    else if (arg === "--codes") opts.codes = new Set(next().split(",").map((c) => c.trim()).filter(Boolean));
    else throw new Error(`Unknown option: ${arg}`);
  }
  return opts;
}

function positiveInt(value: string, flag: string, allowZero = false) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < (allowZero ? 0 : 1)) throw new Error(`${flag} must be a whole number`);
  return n;
}

// ---------------------------------------------------------------------------
// Website products

type SiteVariant = { size: string; code: string; stock: number };

type SiteProduct = {
  code: string;
  name: string;
  price: number;
  categorySlug: string;
  imageUrl: string;
  /** Empty for a single-variant product. */
  sizes: SiteVariant[];
  /** Stock for a single-variant product. */
  singleStock: number | null;
  /** Every internal reference this product owns in Odoo. */
  refs: string[];
};

type Skipped = { code: string; reason: string };

function loadSiteProducts(): { products: SiteProduct[]; skipped: Skipped[] } {
  const raw = JSON.parse(readFileSync(join(root, "data", "products.json"), "utf8")) as Product[];
  const skipped: Skipped[] = [];
  const products: SiteProduct[] = [];

  for (const p of raw) {
    if (p.code === "DPO-TEST") {
      skipped.push({ code: p.code, reason: "payment test product" });
      continue;
    }
    if (p.available === false) {
      skipped.push({ code: p.code, reason: "hidden on the website" });
      continue;
    }
    if (!(p.price > 0)) {
      skipped.push({ code: p.code, reason: "no price" });
      continue;
    }

    const sizes = (p.sizes ?? [])
      .map((s) => ({ size: s.size.trim(), stock: Number.isFinite(s.stock) ? Math.max(0, s.stock) : NaN }))
      .filter((s) => s.size);

    const multi = sizes.length > 1;
    const variants: SiteVariant[] = multi
      ? sizes.map((s) => ({ size: s.size, code: `${p.code}-${s.size}`, stock: s.stock }))
      : [];
    const singleStock = multi
      ? null
      : sizes.length === 1
        ? sizes[0].stock
        : Number.isFinite(p.stockQty)
          ? Math.max(0, p.stockQty)
          : NaN;

    products.push({
      code: p.code,
      name: (p.displayName || p.name).trim(),
      price: p.price,
      categorySlug: p.category,
      imageUrl: p.imageUrl,
      sizes: variants,
      singleStock: Number.isNaN(singleStock) ? null : singleStock,
      refs: multi ? [p.code, ...variants.map((v) => v.code)] : [p.code],
    });
  }

  products.sort((a, b) => a.code.localeCompare(b.code));
  return { products, skipped };
}

function categoryNames(): Map<string, string> {
  const file = join(root, "data", "categories.json");
  const map = new Map<string, string>();
  if (!existsSync(file)) return map;
  for (const c of JSON.parse(readFileSync(file, "utf8")) as Array<{ slug: string; name: string }>) {
    map.set(c.slug, c.name);
  }
  return map;
}

function titleCase(slug: string) {
  return slug
    .split(/[-_]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

// ---------------------------------------------------------------------------
// Helpers

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function pool<T>(items: T[], limit: number, fn: (item: T) => Promise<void>) {
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const item = items[next++];
      await fn(item);
    }
  });
  await Promise.all(workers);
}

function errorText(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

type M2O = [number, string] | false;
const m2oId = (value: M2O) => (Array.isArray(value) ? value[0] : null);

/** Pages by id (id > last seen); offset paging slows down badly on large tables. */
async function readAll<T extends { id: number }>(
  odoo: OdooClient,
  model: string,
  domain: unknown[],
  fields: string[],
  context: Record<string, unknown> = { active_test: false },
): Promise<T[]> {
  const out: T[] = [];
  const page = 2000;
  let lastId = 0;
  for (;;) {
    const rows = await odoo.searchRead<T>(model, [...domain, ["id", ">", lastId]], fields, {
      limit: page,
      order: "id",
      context,
    });
    out.push(...rows);
    if (rows.length) lastId = rows[rows.length - 1].id;
    if (rows.length < page) break;
  }
  return out;
}

/**
 * Download a product photo. Prefer the same wsrv.nl resizer the storefront
 * uses (1024px JPEG, far smaller than the 1–3MB supplier originals), fall back
 * to the original URL, and retry slow or flaky networks.
 */
async function downloadImage(url: string): Promise<Buffer> {
  const resized = `https://wsrv.nl/?${new URLSearchParams({ url, w: "1024", output: "jpg", q: "85" })}`;
  const sources = [resized, url];
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    for (const source of sources) {
      try {
        const res = await fetch(source, {
          signal: AbortSignal.timeout(60_000),
          headers: { "User-Agent": "rappi-webapp-odoo-sync/1.0" },
        });
        const type = res.headers.get("content-type") ?? "";
        if (!res.ok || !type.startsWith("image/")) throw new Error(`image download ${res.status} ${type}`);
        const bytes = Buffer.from(await res.arrayBuffer());
        if (!bytes.length || bytes.length > IMAGE_MAX_BYTES) throw new Error(`image is ${bytes.length} bytes`);
        return bytes;
      } catch (error) {
        lastError = error;
      }
    }
    await new Promise((r) => setTimeout(r, 2_000 * (attempt + 1)));
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

// ---------------------------------------------------------------------------
// Odoo state

type OdooState = {
  online: boolean;
  /** variant internal reference -> template id */
  refToTemplate: Map<string, number>;
  /** exact template name -> template ids, only templates with no coded variant */
  uncodedNameToTemplates: Map<string, number[]>;
  /** all template ids that hold at least one coded variant, with their refs */
  templateRefs: Map<number, string[]>;
  categoryByName: Map<string, number>;
  sizeAttributeId: number | null;
  sizeValueByName: Map<string, number>;
  fields: {
    availableInPos: boolean;
    isStorable: boolean;
  };
  stockLocationId: number | null;
};

async function loadOdooState(odoo: OdooClient | null): Promise<OdooState> {
  const state: OdooState = {
    online: Boolean(odoo),
    refToTemplate: new Map(),
    uncodedNameToTemplates: new Map(),
    templateRefs: new Map(),
    categoryByName: new Map(),
    sizeAttributeId: null,
    sizeValueByName: new Map(),
    fields: { availableInPos: true, isStorable: true },
    stockLocationId: null,
  };
  if (!odoo) return state;

  const templateFields = await odoo.fieldsGet("product.template");
  state.fields.availableInPos = "available_in_pos" in templateFields;
  state.fields.isStorable = "is_storable" in templateFields;

  const variants = await readAll<{ id: number; default_code: string | false; product_tmpl_id: M2O }>(
    odoo,
    "product.product",
    [["default_code", "!=", false]],
    ["default_code", "product_tmpl_id"],
  );
  for (const v of variants) {
    const tmpl = m2oId(v.product_tmpl_id);
    if (!v.default_code || tmpl === null) continue;
    state.refToTemplate.set(v.default_code, tmpl);
    const refs = state.templateRefs.get(tmpl) ?? [];
    refs.push(v.default_code);
    state.templateRefs.set(tmpl, refs);
  }

  const templates = await readAll<{ id: number; name: string }>(odoo, "product.template", [], ["name"]);
  for (const t of templates) {
    if (state.templateRefs.has(t.id)) continue;
    const ids = state.uncodedNameToTemplates.get(t.name) ?? [];
    ids.push(t.id);
    state.uncodedNameToTemplates.set(t.name, ids);
  }

  const categories = await readAll<{ id: number; name: string; parent_id: M2O }>(
    odoo,
    "product.category",
    [],
    ["name", "parent_id"],
  );
  // Prefer a top-level category when the same name exists in several places.
  for (const c of [...categories].sort((a, b) => Number(Boolean(a.parent_id)) - Number(Boolean(b.parent_id)))) {
    if (!state.categoryByName.has(c.name)) state.categoryByName.set(c.name, c.id);
  }

  const [sizeAttr] = await odoo.searchRead<{ id: number }>(
    "product.attribute",
    [["name", "=", SIZE_ATTRIBUTE]],
    ["id"],
    { limit: 1 },
  );
  if (sizeAttr) {
    state.sizeAttributeId = sizeAttr.id;
    const values = await readAll<{ id: number; name: string }>(
      odoo,
      "product.attribute.value",
      [["attribute_id", "=", sizeAttr.id]],
      ["name"],
    );
    for (const v of values) state.sizeValueByName.set(v.name, v.id);
  }

  if (state.fields.isStorable) {
    const [warehouse] = await odoo.searchRead<{ lot_stock_id: M2O }>("stock.warehouse", [], ["lot_stock_id"], {
      limit: 1,
      order: "id",
    });
    state.stockLocationId = warehouse ? m2oId(warehouse.lot_stock_id) : null;
  }

  return state;
}

// ---------------------------------------------------------------------------
// Report

type Report = {
  mode: "dry-run" | "apply";
  odoo: "online" | "offline";
  startedAt: string;
  finishedAt?: string;
  scope: { total: number; selected: number; offset: number; limit?: number };
  skipped: Skipped[];
  categoriesCreated: string[];
  sizeValuesCreated: string[];
  created: Array<{ code: string; name: string; templateId?: number; variants: number }>;
  updated: Array<{ code: string; templateId: number; changes: string[]; matchedBy: "reference" | "name" }>;
  unchanged: string[];
  sizesAdded: Array<{ code: string; sizes: string[] }>;
  stockAdjustments: Array<{ ref: string; from: number; to: number }>;
  imagesUploaded: string[];
  needsReview: Array<{ code: string; reason: string }>;
  errors: Array<{ code: string; step: string; message: string }>;
  inOdooNotOnSite: Array<{ templateId: number; refs: string[] }>;
  warnings: string[];
};

// ---------------------------------------------------------------------------
// Main

async function main() {
  const opts = parseArgs(process.argv.slice(2));

  const envFile = join(root, ".env.local");
  if (existsSync(envFile)) process.loadEnvFile(envFile);

  const timings = new Map<string, { calls: number; ms: number }>();
  const onCall = (model: string, method: string, ms: number) => {
    const key = `${model}.${method}`;
    const t = timings.get(key) ?? { calls: 0, ms: 0 };
    t.calls += 1;
    t.ms += ms;
    timings.set(key, t);
  };

  let odoo: OdooClient | null = null;
  try {
    odoo = createOdooClient(odooConfigFromEnv(), { onCall });
  } catch (error) {
    if (!(error instanceof OdooConfigError)) throw error;
    if (opts.apply) {
      console.error(`Cannot apply: ${error.message}. Put them in .env.local.`);
      process.exit(1);
    }
    console.warn(`Odoo is not configured (${error.message}). Running an OFFLINE dry run: everything is shown as new.`);
  }

  const { products: allProducts, skipped } = loadSiteProducts();
  let selected = opts.codes ? allProducts.filter((p) => opts.codes!.has(p.code)) : allProducts;
  selected = selected.slice(opts.offset, opts.limit ? opts.offset + opts.limit : undefined);
  const partial = Boolean(opts.codes || opts.limit || opts.offset);

  const report: Report = {
    mode: opts.apply ? "apply" : "dry-run",
    odoo: odoo ? "online" : "offline",
    startedAt: new Date().toISOString(),
    scope: { total: allProducts.length, selected: selected.length, offset: opts.offset, limit: opts.limit },
    skipped,
    categoriesCreated: [],
    sizeValuesCreated: [],
    created: [],
    updated: [],
    unchanged: [],
    sizesAdded: [],
    stockAdjustments: [],
    imagesUploaded: [],
    needsReview: [],
    errors: [],
    inOdooNotOnSite: [],
    warnings: [],
  };

  console.log(
    `${opts.apply ? "APPLY" : "DRY RUN"}: ${selected.length} of ${allProducts.length} website products ` +
      `(${skipped.length} skipped: hidden, test or unpriced).`,
  );

  console.log("Reading Odoo…");
  const state = await loadOdooState(odoo);
  if (odoo) {
    console.log(
      `Odoo has ${state.refToTemplate.size} variant references, ${state.categoryByName.size} categories, ` +
        `${state.sizeValueByName.size} size values.`,
    );
    if (!state.fields.availableInPos) report.warnings.push("Point of Sale is not installed: available_in_pos was not set.");
    if (!state.fields.isStorable) report.warnings.push("Inventory is not installed: stock was not set.");
    if (state.fields.isStorable && !state.stockLocationId) report.warnings.push("No warehouse found: stock was not set.");
  }
  const stockEnabled = opts.stock && state.fields.isStorable && (state.stockLocationId !== null || !odoo);

  // Names shared by several site products cannot be used to match.
  const siteNameCount = new Map<string, number>();
  for (const p of allProducts) siteNameCount.set(p.name, (siteNameCount.get(p.name) ?? 0) + 1);

  // --- Categories ----------------------------------------------------------
  const names = categoryNames();
  const categoryName = (slug: string) => names.get(slug) ?? titleCase(slug);
  const neededCategories = [...new Set(selected.map((p) => categoryName(p.categorySlug)))];
  const missingCategories = opts.imagesOnly ? [] : neededCategories.filter((n) => !state.categoryByName.has(n));
  if (missingCategories.length) {
    report.categoriesCreated.push(...missingCategories);
    if (opts.apply && odoo) {
      const ids = await odoo.create(
        "product.category",
        missingCategories.map((name) => ({ name })),
        QUIET,
      );
      missingCategories.forEach((name, i) => state.categoryByName.set(name, ids[i]));
    }
  }

  // --- Size attribute and values ---------------------------------------------
  const neededSizes = opts.imagesOnly ? [] : [...new Set(selected.flatMap((p) => p.sizes.map((s) => s.size)))];
  if (neededSizes.length && opts.apply && odoo && state.sizeAttributeId === null) {
    const [id] = await odoo.create(
      "product.attribute",
      [{ name: SIZE_ATTRIBUTE, create_variant: "always", display_type: "pills" }],
      QUIET,
    );
    state.sizeAttributeId = id;
  }
  const missingSizes = neededSizes.filter((s) => !state.sizeValueByName.has(s));
  if (missingSizes.length) {
    report.sizeValuesCreated.push(...missingSizes);
    if (opts.apply && odoo && state.sizeAttributeId !== null) {
      for (const part of chunk(missingSizes, 100)) {
        const ids = await odoo.create(
          "product.attribute.value",
          part.map((name) => ({ name, attribute_id: state.sizeAttributeId })),
          QUIET,
        );
        part.forEach((name, i) => state.sizeValueByName.set(name, ids[i]));
      }
    }
  }

  // --- Products, in batches --------------------------------------------------
  const touchedTemplates = new Set<number>();
  const batches = chunk(selected, BATCH_SIZE);

  let batchesDone = 0;
  let errorsPrinted = 0;
  await pool([...batches.entries()], opts.parallel, async ([, batch]) => {
    try {
      await syncBatch(batch);
    } catch (error) {
      for (const p of batch) report.errors.push({ code: p.code, step: "batch", message: errorText(error) });
    }
    batchesDone += 1;
    console.log(
      `Batch ${batchesDone}/${batches.length}: created ${report.created.length}, updated ${report.updated.length}, ` +
        `unchanged ${report.unchanged.length}, errors ${report.errors.length}`,
    );
    for (const e of report.errors.slice(errorsPrinted, errorsPrinted + 5)) {
      console.log(`  error ${e.code} [${e.step}]: ${e.message.slice(0, 300)}`);
    }
    errorsPrinted = report.errors.length;
  });

  async function syncBatch(batch: SiteProduct[]) {
    // 1. Match.
    const toCreate: SiteProduct[] = [];
    const toUpdate: Array<{ product: SiteProduct; templateId: number; matchedBy: "reference" | "name" }> = [];

    for (const p of batch) {
      const byRef = new Set(p.refs.map((r) => state.refToTemplate.get(r)).filter((id): id is number => id !== undefined));
      if (byRef.size > 1) {
        report.needsReview.push({ code: p.code, reason: `references split across Odoo templates ${[...byRef].join(", ")}` });
        continue;
      }
      if (byRef.size === 1) {
        toUpdate.push({ product: p, templateId: [...byRef][0], matchedBy: "reference" });
        continue;
      }
      const sameName = state.uncodedNameToTemplates.get(p.name) ?? [];
      if (sameName.length === 1 && siteNameCount.get(p.name) === 1) {
        toUpdate.push({ product: p, templateId: sameName[0], matchedBy: "name" });
        continue;
      }
      if (sameName.length > 1) {
        report.needsReview.push({ code: p.code, reason: `${sameName.length} Odoo products share the name "${p.name}"` });
        continue;
      }
      toCreate.push(p);
    }

    if (opts.imagesOnly) {
      for (const p of toCreate) report.needsReview.push({ code: p.code, reason: "not in Odoo yet; run the sync first" });
      if (opts.apply && odoo) {
        await uploadImages(toUpdate.map((u) => ({ product: u.product, templateId: u.templateId })));
      } else {
        report.unchanged.push(...toUpdate.map((u) => u.product.code));
      }
      return;
    }

    // 2. Create.
    const createdTemplates: Array<{ product: SiteProduct; templateId: number }> = [];
    if (toCreate.length) {
      if (!opts.apply || !odoo) {
        for (const p of toCreate) {
          report.created.push({ code: p.code, name: p.name, variants: Math.max(1, p.sizes.length) });
        }
      } else {
        const vals = toCreate.map((p) => templateVals(p));
        let ids: number[] | null = null;
        try {
          ids = await odoo.create("product.template", vals, QUIET);
        } catch {
          // Isolate the failing product(s).
          ids = null;
        }
        if (ids) {
          toCreate.forEach((p, i) => createdTemplates.push({ product: p, templateId: ids![i] }));
        } else {
          for (const [i, p] of toCreate.entries()) {
            try {
              const [id] = await odoo.create("product.template", [vals[i]], QUIET);
              createdTemplates.push({ product: p, templateId: id });
            } catch (error) {
              report.errors.push({ code: p.code, step: "create", message: errorText(error) });
            }
          }
        }
        for (const { product, templateId } of createdTemplates) {
          report.created.push({
            code: product.code,
            name: product.name,
            templateId,
            variants: Math.max(1, product.sizes.length),
          });
          state.templateRefs.set(templateId, [...product.refs]);
          for (const ref of product.refs) state.refToTemplate.set(ref, templateId);
          touchedTemplates.add(templateId);
        }
      }
    }

    // 3. Update.
    const updatedTemplates: Array<{ product: SiteProduct; templateId: number }> = [];
    if (toUpdate.length && odoo) {
      const fields = ["name", "list_price", "categ_id", "sale_ok", "attribute_line_ids"];
      if (state.fields.availableInPos) fields.push("available_in_pos");
      const rows = await odoo.read<{
        id: number;
        name: string;
        list_price: number;
        categ_id: M2O;
        sale_ok: boolean;
        available_in_pos?: boolean;
        attribute_line_ids: number[];
      }>("product.template", toUpdate.map((u) => u.templateId), fields);
      const byId = new Map(rows.map((r) => [r.id, r]));

      for (const { product, templateId, matchedBy } of toUpdate) {
        touchedTemplates.add(templateId);
        const current = byId.get(templateId);
        if (!current) {
          report.errors.push({ code: product.code, step: "update", message: `template ${templateId} not readable` });
          continue;
        }
        const target = templateVals(product, { forUpdate: true });
        const changes: string[] = [];
        const vals: Record<string, unknown> = {};
        if (current.name !== target.name) {
          changes.push(`name "${current.name}" → "${target.name}"`);
          vals.name = target.name;
        }
        if (Math.abs(current.list_price - (target.list_price as number)) > 0.004) {
          changes.push(`price ${current.list_price} → ${target.list_price}`);
          vals.list_price = target.list_price;
        }
        if (target.categ_id !== undefined && m2oId(current.categ_id) !== target.categ_id) {
          changes.push(`category → ${categoryName(product.categorySlug)}`);
          vals.categ_id = target.categ_id;
        }
        if (!current.sale_ok) {
          changes.push("can be sold → yes");
          vals.sale_ok = true;
        }
        if (state.fields.availableInPos && current.available_in_pos === false) {
          changes.push("available in POS → yes");
          vals.available_in_pos = true;
        }

        if (!changes.length) {
          report.unchanged.push(product.code);
        } else {
          report.updated.push({ code: product.code, templateId, changes, matchedBy });
          if (opts.apply) {
            try {
              await odoo.write("product.template", [templateId], vals, QUIET);
            } catch (error) {
              report.errors.push({ code: product.code, step: "update", message: errorText(error) });
              continue;
            }
          }
        }
        updatedTemplates.push({ product, templateId });
      }

      // Sizes the website has that the Odoo product lacks.
      for (const { product, templateId } of updatedTemplates) {
        const known = new Set(state.templateRefs.get(templateId) ?? []);
        const missing = product.sizes.filter((s) => !known.has(s.code));
        if (!missing.length) continue;
        const line = await sizeLine(templateId);
        if (!line) {
          report.needsReview.push({
            code: product.code,
            reason: `has no Size attribute in Odoo; missing sizes ${missing.map((s) => s.size).join(", ")}`,
          });
          continue;
        }
        const missingValues = missing.filter((s) => !line.valueIds.includes(state.sizeValueByName.get(s.size) ?? -1));
        report.sizesAdded.push({ code: product.code, sizes: missing.map((s) => s.size) });
        if (opts.apply && missingValues.length) {
          try {
            await odoo.write(
              "product.template.attribute.line",
              [line.id],
              { value_ids: missingValues.map((s) => [4, state.sizeValueByName.get(s.size)]) },
              QUIET,
            );
          } catch (error) {
            report.errors.push({ code: product.code, step: "add sizes", message: errorText(error) });
          }
        }
      }
    }

    if (!opts.apply || !odoo) return;

    // 4. Variant internal references for every multi-size product touched.
    const coded = [...createdTemplates, ...updatedTemplates].filter((t) => t.product.sizes.length);
    const variantIdByRef = await assignVariantRefs(coded);

    // Single-size products: their one variant carries the code.
    const singles = [...createdTemplates, ...updatedTemplates].filter((t) => !t.product.sizes.length);
    if (singles.length) {
      const rows = await odoo.searchRead<{ id: number; product_tmpl_id: M2O }>(
        "product.product",
        [["product_tmpl_id", "in", singles.map((s) => s.templateId)]],
        ["product_tmpl_id"],
        { context: { active_test: false } },
      );
      const variantByTemplate = new Map(rows.map((r) => [m2oId(r.product_tmpl_id), r.id]));
      for (const { product, templateId } of singles) {
        const id = variantByTemplate.get(templateId);
        if (id) variantIdByRef.set(product.code, id);
      }
    }

    // 5. Stock.
    if (stockEnabled && state.stockLocationId !== null) {
      const targets: Array<{ ref: string; variantId: number; qty: number; isNew: boolean }> = [];
      const created = new Set(createdTemplates.map((t) => t.product.code));
      for (const { product } of [...createdTemplates, ...updatedTemplates]) {
        const isNew = created.has(product.code);
        if (product.sizes.length) {
          for (const s of product.sizes) {
            const id = variantIdByRef.get(s.code);
            if (id && Number.isFinite(s.stock)) targets.push({ ref: s.code, variantId: id, qty: s.stock, isNew });
          }
        } else if (product.singleStock !== null) {
          const id = variantIdByRef.get(product.code);
          if (id) targets.push({ ref: product.code, variantId: id, qty: product.singleStock, isNew });
        }
      }
      await setStock(targets);
    }

    // 6. Images (opt-in).
    if (opts.images) {
      await uploadImages([...createdTemplates, ...updatedTemplates]);
    }
  }

  function templateVals(p: SiteProduct, { forUpdate = false } = {}) {
    const vals: Record<string, unknown> = {
      name: p.name,
      list_price: p.price,
      sale_ok: true,
    };
    const categ = state.categoryByName.get(categoryName(p.categorySlug));
    if (categ !== undefined) vals.categ_id = categ;
    if (state.fields.availableInPos) vals.available_in_pos = true;
    if (forUpdate) return vals;

    vals.type = "consu";
    if (state.fields.isStorable) vals.is_storable = true;
    if (p.sizes.length && state.sizeAttributeId !== null) {
      vals.attribute_line_ids = [
        [
          0,
          0,
          {
            attribute_id: state.sizeAttributeId,
            value_ids: [[6, 0, p.sizes.map((s) => state.sizeValueByName.get(s.size)).filter(Boolean)]],
          },
        ],
      ];
    } else {
      vals.default_code = p.code;
    }
    return vals;
  }

  async function sizeLine(templateId: number) {
    if (!odoo || state.sizeAttributeId === null) return null;
    const [line] = await odoo.searchRead<{ id: number; value_ids: number[] }>(
      "product.template.attribute.line",
      [
        ["product_tmpl_id", "=", templateId],
        ["attribute_id", "=", state.sizeAttributeId],
      ],
      ["value_ids"],
      { limit: 1 },
    );
    return line ? { id: line.id, valueIds: line.value_ids } : null;
  }

  /** Sets "<code>-<size>" on each size variant. Returns ref -> variant id. */
  async function assignVariantRefs(templates: Array<{ product: SiteProduct; templateId: number }>) {
    const result = new Map<string, number>();
    if (!odoo || !templates.length) return result;

    const variants = await odoo.searchRead<{
      id: number;
      product_tmpl_id: M2O;
      default_code: string | false;
      product_template_variant_value_ids: number[];
    }>(
      "product.product",
      [["product_tmpl_id", "in", templates.map((t) => t.templateId)]],
      ["product_tmpl_id", "default_code", "product_template_variant_value_ids"],
      { context: { active_test: false } },
    );
    const ptavIds = [...new Set(variants.flatMap((v) => v.product_template_variant_value_ids))];
    const ptavs = ptavIds.length
      ? await odoo.read<{ id: number; attribute_id: M2O; product_attribute_value_id: M2O }>(
          "product.template.attribute.value",
          ptavIds,
          ["attribute_id", "product_attribute_value_id"],
        )
      : [];
    const sizeNameById = new Map<number, string>();
    const valueNameById = new Map([...state.sizeValueByName].map(([name, id]) => [id, name]));
    for (const ptav of ptavs) {
      if (m2oId(ptav.attribute_id) !== state.sizeAttributeId) continue;
      const valueId = m2oId(ptav.product_attribute_value_id);
      const name = valueId !== null ? valueNameById.get(valueId) : undefined;
      if (name) sizeNameById.set(ptav.id, name);
    }

    const productByTemplate = new Map(templates.map((t) => [t.templateId, t.product]));
    const writes: Array<{ id: number; ref: string; code: string }> = [];
    for (const v of variants) {
      const product = productByTemplate.get(m2oId(v.product_tmpl_id) ?? -1);
      if (!product) continue;
      const size = v.product_template_variant_value_ids.map((id) => sizeNameById.get(id)).find(Boolean);
      if (!size) continue;
      const ref = `${product.code}-${size}`;
      result.set(ref, v.id);
      if (v.default_code !== ref) writes.push({ id: v.id, ref, code: product.code });
    }

    const templateByCode = new Map(templates.map((t) => [t.product.code, t.templateId]));
    const remember = (w: { ref: string; code: string }) => state.refToTemplate.set(w.ref, templateByCode.get(w.code)!);

    // One bulk `load` (Odoo's import) per 500 variants instead of one write each.
    for (const part of chunk(writes, 500)) {
      try {
        const res = await odoo.call<{ ids: number[] | false; messages: Array<{ type: string; message: string }> }>(
          "product.product",
          "load",
          { fields: [".id", "default_code"], data: part.map((w) => [String(w.id), w.ref]), context: QUIET },
        );
        const problems = res.messages.filter((m) => m.type === "error");
        if (res.ids && !problems.length) {
          part.forEach(remember);
          continue;
        }
        throw new Error(problems.map((m) => m.message).join("; ") || "load returned no ids");
      } catch {
        // Fall back to one write per variant so a single bad row is isolated.
        await pool(part, WRITE_CONCURRENCY, async (w) => {
          try {
            await odoo!.write("product.product", [w.id], { default_code: w.ref }, QUIET);
            remember(w);
          } catch (error) {
            report.errors.push({ code: w.code, step: `reference ${w.ref}`, message: errorText(error) });
          }
        });
      }
    }
    return result;
  }

  async function setStock(targets: Array<{ ref: string; variantId: number; qty: number; isNew: boolean }>) {
    if (!odoo || !targets.length || state.stockLocationId === null) return;
    // Variants created in this run have no stock yet; only look up existing ones.
    const existing = targets.filter((t) => !t.isNew).map((t) => t.variantId);
    const quants = existing.length
      ? await odoo.searchRead<{ product_id: M2O; quantity: number }>(
          "stock.quant",
          [
            ["product_id", "in", existing],
            ["location_id", "=", state.stockLocationId],
          ],
          ["product_id", "quantity"],
        )
      : [];
    const onHand = new Map<number, number>();
    for (const q of quants) {
      const id = m2oId(q.product_id);
      if (id !== null) onHand.set(id, (onHand.get(id) ?? 0) + q.quantity);
    }
    const changes = targets.filter((t) => (onHand.get(t.variantId) ?? 0) !== t.qty);
    if (!changes.length) return;

    for (const part of chunk(changes, 100)) {
      try {
        const ids = await odoo.create(
          "stock.quant",
          part.map((t) => ({
            product_id: t.variantId,
            location_id: state.stockLocationId,
            inventory_quantity: t.qty,
          })),
          { ...QUIET, inventory_mode: true },
        );
        await odoo.call("stock.quant", "action_apply_inventory", {
          ids,
          context: { ...QUIET, inventory_mode: true },
        });
        for (const t of part) {
          report.stockAdjustments.push({ ref: t.ref, from: onHand.get(t.variantId) ?? 0, to: t.qty });
        }
      } catch (error) {
        for (const t of part) {
          report.errors.push({ code: t.ref, step: "stock", message: errorText(error) });
        }
      }
    }
  }

  async function uploadImages(templates: Array<{ product: SiteProduct; templateId: number }>) {
    if (!odoo || !templates.length) return;
    let withoutImage: Set<number>;
    try {
      const rows = await odoo.searchRead<{ id: number }>(
        "product.template",
        [
          ["id", "in", templates.map((t) => t.templateId)],
          ["image_1920", "=", false],
        ],
        ["id"],
        { context: { active_test: false } },
      );
      withoutImage = new Set(rows.map((r) => r.id));
    } catch {
      withoutImage = new Set(templates.map((t) => t.templateId));
    }

    await pool(
      templates.filter((t) => withoutImage.has(t.templateId) && t.product.imageUrl?.startsWith("https://")),
      4,
      async ({ product, templateId }) => {
        try {
          const bytes = await downloadImage(product.imageUrl);
          await odoo!.write("product.template", [templateId], { image_1920: bytes.toString("base64") }, QUIET);
          report.imagesUploaded.push(product.code);
        } catch (error) {
          report.errors.push({ code: product.code, step: "image", message: errorText(error) });
        }
      },
    );
  }

  // --- Products in Odoo that the website no longer has -------------------------
  if (odoo && !partial) {
    const siteRefs = new Set(allProducts.flatMap((p) => p.refs));
    for (const [templateId, refs] of state.templateRefs) {
      if (touchedTemplates.has(templateId)) continue;
      // Only templates this sync could have made: references shaped like site codes.
      if (!refs.some((r) => /^\d{3,}\.\d+/.test(r))) continue;
      if (refs.some((r) => siteRefs.has(r))) continue;
      report.inOdooNotOnSite.push({ templateId, refs: refs.slice(0, 5) });
    }
  }

  // --- Summary -----------------------------------------------------------------
  report.finishedAt = new Date().toISOString();
  const outDir = join(root, "tmp", "odoo-sync");
  mkdirSync(outDir, { recursive: true });
  const outFile = join(outDir, `report-${report.startedAt.replace(/[:.]/g, "-")}.json`);
  writeFileSync(outFile, JSON.stringify(report, null, 2));

  const verb = opts.apply ? "" : "would be ";
  console.log("\n=== Summary ===");
  console.log(`Mode:                 ${opts.apply ? "APPLY" : "DRY RUN (nothing changed)"}${odoo ? "" : ", offline"}`);
  console.log(`Products ${verb}created: ${report.created.length}`);
  console.log(`Products ${verb}updated: ${report.updated.length}`);
  console.log(`Unchanged:            ${report.unchanged.length}`);
  console.log(`Categories ${verb}created: ${report.categoriesCreated.length} ${report.categoriesCreated.join(", ")}`);
  console.log(`Size values ${verb}created: ${report.sizeValuesCreated.length}`);
  console.log(`Sizes ${verb}added to existing products: ${report.sizesAdded.length}`);
  if (opts.apply) console.log(`Stock adjustments:    ${report.stockAdjustments.length}`);
  else console.log(`Stock:                ${stockEnabled ? "set per size after create (not simulated in dry run)" : "not touched"}`);
  if (opts.images) console.log(`Images uploaded:      ${report.imagesUploaded.length}`);
  console.log(`Skipped on website:   ${report.skipped.length}`);
  console.log(`Needs review:         ${report.needsReview.length}`);
  console.log(`Errors:               ${report.errors.length}`);
  if (odoo && !partial) console.log(`In Odoo, not on site: ${report.inOdooNotOnSite.length} (left untouched)`);
  for (const w of report.warnings) console.log(`Warning: ${w}`);
  if (timings.size) {
    console.log("\nOdoo time by call (total seconds / calls):");
    for (const [key, t] of [...timings].sort((a, b) => b[1].ms - a[1].ms).slice(0, 12)) {
      console.log(`  ${(t.ms / 1000).toFixed(1).padStart(8)}s  ${String(t.calls).padStart(6)}  ${key}`);
    }
  }

  const sample = report.created.slice(0, 10);
  if (sample.length) {
    console.log(`\nFirst ${sample.length} ${verb}created:`);
    for (const c of sample) {
      console.log(`  ${c.code}  ${c.name}  (${c.variants} variant${c.variants === 1 ? "" : "s"})${c.templateId ? `  → template ${c.templateId}` : ""}`);
    }
  }
  for (const u of report.updated.slice(0, 10)) console.log(`  update ${u.code}: ${u.changes.join("; ")}`);
  for (const e of report.errors.slice(0, 10)) console.log(`  error ${e.code} [${e.step}]: ${e.message}`);
  for (const r of report.needsReview.slice(0, 10)) console.log(`  review ${r.code}: ${r.reason}`);
  console.log(`\nFull report: ${outFile}`);

  if (report.errors.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error(errorText(error));
  process.exit(1);
});
