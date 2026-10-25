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
import { CATALOG_CACHE_TAG } from "../lib/catalog-cache-tag";
import { secretsMatch } from "../lib/catalog-revalidate-auth";
import { catalogVersion } from "../lib/catalog-version";
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
assert.equal(secretsMatch("same-secret-value", "same-secret-value"), true);
assert.equal(secretsMatch("same-secret-valuX", "same-secret-value"), false);
assert.equal(secretsMatch("short", "same-secret-value"), false);
assert.equal(secretsMatch("", "same-secret-value"), false);
assert.equal(secretsMatch("same-secret-value", ""), false);

const revalidateRoute = read("app/api/catalog/revalidate/route.ts");
const secretCompare = `function secretsMatch(provided: string, expected: string) {
  // An unset secret must never match, including an empty Authorization header.
  // Hashing first keeps the compare the same length, so a short guess does not
  // return before timingSafeEqual.
  if (!expected) return false;
  const a = createHash("sha256").update(provided).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}`;
assert.equal(revalidateRoute.includes(secretCompare), true);
assert.equal(revalidateRoute.includes("secretsMatch"), true);
assert.equal(revalidateRoute.includes('headers.get("authorization")'), true);
assert.equal(revalidateRoute.includes("x-catalog-revalidate-secret"), true);
assert.equal(revalidateRoute.includes("searchParams"), false);
assert.equal(revalidateRoute.includes("request.url"), false);
assert.equal(revalidateRoute.includes("console."), false);
assert.equal(revalidateRoute.includes("NEXT_PUBLIC_"), false);
assert.equal(revalidateRoute.includes('status: 405'), true);
assert.equal(revalidateRoute.includes('status: 503'), true);
assert.equal(revalidateRoute.includes('status: 429'), true);
assert.equal(secretsMatch("abc", "€€€"), false);
assert.equal(revalidateRoute.includes("consumeRateLimit(REVALIDATE_LIMIT_KEY"), true);
assert.equal(revalidateRoute.includes("export function GET()"), true);
assert.equal(revalidateRoute.includes("revalidatePath"), false);
const missingSecret = revalidateRoute.indexOf("Catalog revalidate is not configured.");
const authCheck = revalidateRoute.indexOf("if (!authorized(request))");
const limitCheck = revalidateRoute.indexOf("consumeRateLimit(REVALIDATE_LIMIT_KEY");
const purge = revalidateRoute.lastIndexOf("revalidateCatalog()");
assert.equal(missingSecret > -1 && missingSecret < authCheck && authCheck < limitCheck && limitCheck < purge, true);
const authReturn = "return secretsMatch(bearer, expected) || secretsMatch(custom, expected);";
assert.equal(revalidateRoute.includes(authReturn), true);
assert.equal(revalidateRoute.includes("bearerOk"), false);

const authLib = read("lib/catalog-revalidate-auth.ts");
assert.equal(authLib.includes(secretCompare.replace("function secretsMatch", "export function secretsMatch")), true);
assert.equal(authLib.includes("timingSafeEqual"), true);
assert.equal(authLib.includes('createHash("sha256")'), true);
assert.equal(authLib.includes("if (!expected) return false;"), true);

const revalidateLib = read("lib/admin/revalidate-catalog.ts");
assert.equal(revalidateLib.includes('import "server-only"'), true);
assert.equal(revalidateLib.includes("export function revalidateCatalog()"), true);
assert.equal(revalidateLib.includes("revalidateTag(CATALOG_CACHE_TAG, { expire: 0 })"), true);
assert.equal(revalidateLib.includes("revalidatePath"), false);
assert.equal(revalidateLib.includes('revalidatePath("/", "layout")'), false);

const action = read("lib/admin/revalidate-catalog-action.ts");
assert.equal(action.includes("export async function revalidateCatalogAfterWrite()"), true);
assert.equal(action.includes('supabase.rpc("is_admin")'), true);
const adminCheck = action.indexOf('supabase.rpc("is_admin")');
const revalidateCall = action.indexOf("revalidateCatalog()");
assert.equal(adminCheck > -1 && revalidateCall > adminCheck, true);
assert.equal(action.includes("searchParams"), false);
assert.equal(action.includes("CATALOG_REVALIDATE_SECRET"), false);

const editor = read("components/admin/product-editor.tsx");
assert.equal(editor.includes("revalidateCatalogAfterWrite"), true);
assert.equal(editor.includes("CATALOG_REVALIDATE_SECRET"), false);
assert.equal(editor.includes("revalidateTag"), false);
assert.equal(editor.includes("revalidatePath"), false);
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
    `catalog version ok (${baked.length} baked products, version ${bakedVersion}, tag ${CATALOG_CACHE_TAG})`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
