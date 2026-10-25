/**
 * Old public slugs (joma-flow, joma-kids) and the new ones (flow, kids)
 * must select the same products. The live Flow folder is empty, so the
 * product-set check uses a fixture. Responses keep the new slug and label.
 *
 * Run: npx tsx scripts/check-slug-aliases.ts
 */
import assert from "node:assert/strict";
import nextConfig from "../next.config";
import { buildListing, filterListing, listingHref, parseListingQuery } from "../lib/listing-core";
import { jomaFolderByKey } from "../lib/joma-tree";
import type { ListingItem } from "../lib/listing-types";
import { canonicalSlug, canonicalSlugLabel } from "../lib/slug-aliases";

function item(code: string, subcategory: string, folders: string[]): ListingItem {
  return {
    id: code,
    code,
    item: code,
    title: code,
    name: code,
    displayName: code,
    category: "shoes",
    subcategory,
    gender: "unisex",
    price: 10,
    unitPrice: 10,
    currency: "NAD",
    sheetCategory: null,
    totalQty: 1,
    stockQty: 1,
    badge: null,
    sizeOptions: ["42"],
    sizes: [{ size: "42", stock: 1 }],
    imageUrl: "/brand/placeholder.webp",
    images: ["/brand/placeholder.webp"],
    available: true,
    hasImage: true,
    folders,
  };
}

const catalog = [
  item("FLOW-NEW", "flow", ["flow"]),
  item("FLOW-OLD", "joma-flow", ["joma-flow"]),
  item("OTHER", "running-shoes", ["running-shoes"]),
];

function codes(query: { sub?: string; group?: string }) {
  return filterListing(catalog, query)
    .map((product) => product.code)
    .sort();
}

const same = ["FLOW-NEW", "FLOW-OLD"];
assert.deepEqual(codes({ sub: "flow" }), same);
assert.deepEqual(codes({ sub: "joma-flow" }), same);
assert.deepEqual(codes({ group: "flow" }), same);
assert.deepEqual(codes({ group: "joma-flow" }), same);

for (const query of [{ sub: "joma-flow" }, { sub: "flow" }, { group: "joma-flow" }, { group: "flow" }]) {
  const listing = buildListing(catalog, query);
  assert.deepEqual(
    listing.products.map((product) => product.code).sort(),
    same,
  );
  assert.ok(listing.products.every((product) => product.subcategory === "flow"));
  const facet = listing.facets.subs.find((sub) => sub.slug === "flow");
  assert.equal(facet?.name, "Flow");
  assert.equal(facet?.count, 2);
  assert.equal(
    listing.facets.subs.some((sub) => sub.slug === "joma-flow" || sub.slug === "joma-kids"),
    false,
  );
}

assert.equal(canonicalSlug("joma-kids"), "kids");
assert.equal(canonicalSlug("kids"), "kids");
assert.equal(canonicalSlugLabel("joma-kids"), "KIDS");
assert.equal(canonicalSlugLabel("joma-flow"), "Flow");
assert.equal(parseListingQuery({ sub: "joma-flow", group: "joma-flow" }).group, "flow");
assert.equal(parseListingQuery({ sub: "joma-flow" }).sub, "flow");
assert.equal(
  listingHref("/shop/shoes", { sub: "joma-flow", group: "joma-flow" }),
  "/shop/shoes?sub=flow&group=flow",
);

const flow = jomaFolderByKey("joma-flow");
assert.equal(flow?.key, "flow");
assert.equal(flow?.label, "Flow");
assert.equal(jomaFolderByKey("flow"), flow);

async function main() {
const loadRedirects = nextConfig.redirects;
if (!loadRedirects) throw new Error("next redirects are missing");
const redirects = await loadRedirects();
const queryRedirects = redirects.filter((rule) =>
  rule.has?.some(
    (match) =>
      match.type === "query" &&
      (match.key === "tab" || match.key === "group" || match.key === "sub"),
  ),
);
assert.equal(queryRedirects.length, 3);
for (const rule of queryRedirects) {
  assert.equal(rule.permanent, true);
  assert.match(rule.source, /\(\?!api/);
}
assert.ok(
  redirects.some(
    (rule) => rule.source === "/shop/joma-flow" && rule.destination === "/shop/shoes?group=flow" && rule.permanent,
  ),
);

console.log("slug aliases ok: old and new slugs return FLOW-NEW, FLOW-OLD");
}

main();
