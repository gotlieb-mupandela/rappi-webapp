/**
 * Catalogue version is a short hash of the same product rows the API returns.
 * Also checks the revalidate route still takes its secret from a header and
 * that catalogue cache paths are fixed literals.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import Module from "node:module";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { catalogVersion } from "../lib/catalog-version";
import {
  CATALOG_CACHE_TAG,
  CATALOG_REVALIDATE_DYNAMIC_PATHS,
  CATALOG_REVALIDATE_PATHS,
} from "../lib/catalog-revalidate-paths";
import type { Product } from "../lib/types";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const shim = join(root, "scripts/shims/server-only.cjs");
const moduleWithResolve = Module as unknown as {
  _resolveFilename: (request: string, parent: NodeModule | null, isMain: boolean, options?: object) => string;
};
const originalResolve = moduleWithResolve._resolveFilename;
moduleWithResolve._resolveFilename = function resolve(request, parent, isMain, options) {
  if (request === "server-only") return shim;
  return originalResolve.call(this, request, parent, isMain, options);
};

function product(overrides: Partial<Product> & Pick<Product, "code">): Product {
  return {
    id: overrides.code,
    item: "Item",
    title: "Title",
    name: "Name",
    displayName: "Display",
    category: "sportswear",
    subcategory: "general",
    gender: "unisex",
    price: 100,
    unitPrice: 100,
    currency: "NAD",
    sheetCategory: null,
    totalQty: 4,
    stockQty: 4,
    badge: null,
    sizeOptions: ["S"],
    sizes: [{ size: "S", stock: 4 }],
    imageUrl: "/products/a.webp",
    images: ["/products/a.webp"],
    available: true,
    ...overrides,
  };
}

function read(relative: string) {
  return readFileSync(join(root, relative), "utf8");
}

const first = product({ code: "b" });
const second = product({ code: "a", price: 50, stockQty: 1, totalQty: 1, sizes: [{ size: "M", stock: 1 }] });
const forward = catalogVersion([first, second]);
const reversed = catalogVersion([second, first]);
assert.equal(forward, reversed);
assert.match(forward, /^[0-9a-f]{12}$/);
assert.equal(catalogVersion([first, second]), forward);

const priced = catalogVersion([first, product({ ...second, price: second.price + 1 })]);
assert.notEqual(priced, forward);

const stocked = catalogVersion([
  first,
  product({ ...second, stockQty: 9, sizes: [{ size: "M", stock: 9 }] }),
]);
assert.notEqual(stocked, forward);

const cacheBusted = catalogVersion([
  first,
  product({
    ...second,
    imageUrl: `${second.imageUrl}?v=abc`,
    images: [`${second.images[0]}?v=abc`],
  }),
]);
assert.equal(cacheBusted, forward);

const replacedImage = catalogVersion([
  first,
  product({ ...second, imageUrl: "/products/b.webp", images: ["/products/b.webp"] }),
]);
assert.notEqual(replacedImage, forward);

const empty = catalogVersion([]);
assert.match(empty, /^[0-9a-f]{12}$/);
assert.equal(empty, createHash("sha256").digest("hex").slice(0, 12));

assert.equal(CATALOG_CACHE_TAG, "catalog");
for (const path of CATALOG_REVALIDATE_PATHS) {
  assert.equal(path.startsWith("/api/"), true);
  assert.equal(path.includes("?"), false);
  assert.equal(path.includes("$"), false);
}
assert.equal(CATALOG_REVALIDATE_PATHS.includes("/api/catalog"), true);
assert.equal(CATALOG_REVALIDATE_PATHS.includes("/api/search"), true);
assert.equal(CATALOG_REVALIDATE_PATHS.includes("/api/mobile/storefront"), true);
assert.deepEqual(CATALOG_REVALIDATE_DYNAMIC_PATHS, [
  { path: "/api/products/[...code]", type: "page" },
]);

const revalidateRoute = read("app/api/catalog/revalidate/route.ts");
assert.equal(revalidateRoute.includes("timingSafeEqual"), true);
assert.equal(revalidateRoute.includes('headers.get("authorization")'), true);
assert.equal(revalidateRoute.includes("x-catalog-revalidate-secret"), true);
assert.equal(revalidateRoute.includes("searchParams"), false);
assert.equal(revalidateRoute.includes("request.url"), false);
assert.equal(revalidateRoute.includes("console."), false);

const revalidateLib = read("lib/admin/revalidate-catalog.ts");
assert.equal(revalidateLib.includes("export function revalidateCatalog()"), true);
assert.equal(revalidateLib.includes("revalidateTag(CATALOG_CACHE_TAG, { expire: 0 })"), true);
assert.equal(revalidateLib.includes("CATALOG_REVALIDATE_PATHS"), true);
assert.equal(revalidateLib.includes("CATALOG_REVALIDATE_DYNAMIC_PATHS"), true);

const action = read("lib/admin/revalidate-catalog-action.ts");
assert.equal(action.includes("export async function revalidateCatalogAfterWrite()"), true);
assert.equal(action.includes('supabase.rpc("is_admin")'), true);
assert.equal(action.includes("searchParams"), false);

const editor = read("components/admin/product-editor.tsx");
assert.equal(editor.includes("revalidateCatalogAfterWrite"), true);
const uploadStart = editor.indexOf("async function onUpload");
const uploadEnd = editor.indexOf("async function refreshCatalogueCache");
assert.equal(editor.slice(uploadStart, uploadEnd).includes("revalidateCatalogAfterWrite"), false);
assert.equal(editor.includes("await refreshCatalogueCache()"), true);

const catalogRoute = read("app/api/catalog/route.ts");
const storefrontRoute = read("app/api/mobile/storefront/route.ts");
assert.equal(catalogRoute.includes("version: catalogVersion(catalog)"), true);
assert.equal(storefrontRoute.includes("version: catalogVersion(catalog)"), true);

async function main() {
  const { getOfflineCatalog } = await import("../lib/offline-catalog");
  const baked = await getOfflineCatalog();
  const bakedVersion = catalogVersion(baked);
  assert.match(bakedVersion, /^[0-9a-f]{12}$/);
  assert.equal(catalogVersion(baked), bakedVersion);
  assert.equal(baked.length > 40, true);

  console.log(
    `catalog version ok (${baked.length} baked products, version ${bakedVersion}, paths ${CATALOG_REVALIDATE_PATHS.length})`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
