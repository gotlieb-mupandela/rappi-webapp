import assert from "node:assert/strict";
import { test } from "node:test";
import { offlineCatalog } from "../lib/offline-catalog";
import { buildListing } from "../lib/listing-core";
import type { ListingItem } from "../lib/listing-types";

const catalog = offlineCatalog as ListingItem[];
const FOOTWEAR = /shoe|sneaker|boot|football-(fg|ag|sg)|turf|futsal|trail-running|barefoot|sandal/;
const search = (q: string) => buildListing(catalog, { q }, { requireQuery: true, pageSize: 60 });

test('"shows" is read as shoes and lists footwear only', () => {
  const r = search("shows");
  assert.ok(r.total >= 200, `total ${r.total}`);
  assert.equal(r.searchNote?.corrected, "shoes");
  assert.ok(r.products.every((p) => FOOTWEAR.test(p.subcategory) || p.category === "shoes"), r.products.map((p) => p.subcategory).join(","));
});

test('"shoes" lists every kind of footwear', () => {
  const r = search("shoes");
  const subs = new Set(r.products.map((p) => p.subcategory));
  assert.ok(r.total >= 1000, `total ${r.total}`);
  assert.ok(subs.size >= 3, [...subs].join(","));
});

test('"rugby shoes" falls back to football boots with a note', () => {
  const r = search("rugby shoes");
  assert.equal(r.searchNote?.closest, true);
  assert.match(r.searchNote?.message ?? "", /rugby/i);
  assert.ok(r.products.slice(0, 10).every((p) => /football-(fg|sg)|boots/.test(p.subcategory)), r.products.slice(0, 10).map((p) => p.subcategory).join(","));
});

test('"rugby shirts" gives rugby jerseys first', () => {
  const r = search("rugby shirts");
  assert.ok(r.total > 0);
  assert.ok(!r.searchNote?.closest);
  assert.ok(r.products.slice(0, 10).every((p) => p.category === "rugby" || /rugby/i.test(p.name)), r.products.slice(0, 10).map((p) => `${p.category}/${p.subcategory}`).join(","));
});

test('"boots" gives football boots', () => {
  const r = search("boots");
  assert.ok(r.total >= 50);
  assert.ok(r.products.slice(0, 20).every((p) => /boots|football-(fg|ag|sg)|turf/.test(p.subcategory) || /boot/i.test(p.name)), r.products.slice(0, 20).map((p) => p.subcategory).join(","));
});

test('"t-shirt" and "tshirt" give tees', () => {
  for (const q of ["t-shirt", "tshirt", "tees"]) {
    const r = search(q);
    assert.ok(r.total > 100, `${q}: ${r.total}`);
    assert.ok(r.products.slice(0, 10).every((p) => /tees|jerseys|polos|tops|sets/.test(p.subcategory)), q);
  }
});

test('"school shoes" gives kids footwear', () => {
  const r = search("school shoes");
  assert.ok(r.total > 10);
  assert.ok(r.products.slice(0, 10).every((p) => p.subcategory === "kids-shoes" || /school/i.test(p.name)), r.products.slice(0, 10).map((p) => p.name).join(" | "));
});

test("exact product code comes back first", () => {
  const r = search("RR600W2691");
  assert.equal(r.products[0]?.code, "RR600W2691");
});

test('"padel racket" gives rackets', () => {
  const r = search("padel racket");
  assert.ok(r.total > 0);
  assert.ok(r.products.slice(0, 3).every((p) => p.subcategory === "rackets"), r.products.slice(0, 3).map((p) => p.name).join(" | "));
});

test("typos: footbal boots, tracksuite, sneekers", () => {
  assert.ok(search("footbal boots").total > 20);
  assert.ok(search("tracksuite").products.slice(0, 5).every((p) => p.subcategory === "tracksuits"));
  assert.ok(search("sneekers").total > 50);
});

test("nonsense does not crash", () => {
  const r = search("qwzx");
  assert.equal(r.total, 0);
  assert.equal(search("").total, 0);
});
