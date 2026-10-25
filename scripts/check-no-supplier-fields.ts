/**
 * Public payloads must not carry supplier line fields, and a public `line`
 * must not end in &, /, or -.
 * Scans public/listing-index.json, a local sample of client product JSON,
 * and built client chunks under .next/static.
 * Prerendered pages under .next/server/app are scanned only when that
 * directory exists, which a full `npm run build` creates.
 *
 * Run after `npm run build` so the chunk scan has output to read.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import raw from "../data/products.json";
import { productLineLabel } from "../lib/joma-item";
import { toClientProduct } from "../lib/listing-core";
import type { Product } from "../lib/types";

const root = join(import.meta.dirname, "..");
const listingPath = join(root, "public", "listing-index.json");
const staticDir = join(root, ".next", "static");

const BANNED = ["Joma Flow [", "JOMA KIDS SET"];
const SUPPLIER_TOKEN = /joma/i;
const TRAILING_SEPARATOR = /(?:&|\/|-)$/;
const STRING_KEY = /"(item|sheetCategory)"\s*:\s*"/g;
const LINE_VALUE = /"line"\s*:\s*"([^"\\]*)"/gi;

const LINE_CASES: Array<[string, string]> = [
  ["Jackets & Sweatshirts [186]", "Jackets & Sweatshirts"],
  ["Pants / Shorts [200]", "Pants / Shorts"],
  ["T-shirt / Top [183]", "T-Shirt / Top"],
  ["Tennis - Padel woman [48]", "Tennis - Padel"],
  ["3.99 - 4.99 [164]", "3.99 - 4.99"],
  ["Atheletes / Combat [23]", "Atheletes / Combat"],
  ["Sweatshirt / Jacket [124]", "Sweatshirt"],
  ["T-shirts & Polo Shirts [62]", "T-Shirts & Polo"],
  ["Fitness / Gym Accessories [64]", "Fitness / Gym"],
  ["Jackets & Black", "Jackets"],
  ["Jackets &", "Jackets"],
  ["JOMA Jackets & Sweatshirts", "Jackets & Sweatshirts"],
];

let failed = 0;

function fail(message: string) {
  failed += 1;
  console.error(`FAIL ${message}`);
}

function walk(dir: string, out: string[]) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const stat = statSync(path);
    if (stat.isDirectory()) walk(path, out);
    else if (/\.(js|json|mjs|cjs)$/.test(name)) out.push(path);
  }
}

function bannedHits(text: string) {
  return BANNED.filter((needle) => text.includes(needle));
}

function assertNoSupplierKeys(rows: Array<Record<string, unknown>>, label: string) {
  for (const row of rows) {
    const code = String(row.code ?? "?");
    if (Object.prototype.hasOwnProperty.call(row, "item")) {
      fail(`${label} ${code} still has item`);
    }
    if (Object.prototype.hasOwnProperty.call(row, "sheetCategory")) {
      fail(`${label} ${code} still has sheetCategory`);
    }
    if (typeof row.line !== "string") {
      fail(`${label} ${code} is missing line`);
      continue;
    }
    assertPublicLine(row.line, `${label} ${code}`);
  }
}

function assertPublicLine(line: string, label: string) {
  if (SUPPLIER_TOKEN.test(line)) {
    fail(`${label} line contains a supplier token`);
  }
  if (TRAILING_SEPARATOR.test(line.trim())) {
    fail(`${label} line ends in a separator: ${JSON.stringify(line)}`);
  }
}

const listingText = readFileSync(listingPath, "utf8");
const listing = JSON.parse(listingText) as Array<Record<string, unknown>>;
assertNoSupplierKeys(listing, "listing-index");
for (const needle of bannedHits(listingText)) fail(`listing-index contains ${JSON.stringify(needle)}`);

const catalog = raw as Product[];
const clientRows = catalog.map((product) => toClientProduct(product) as unknown as Record<string, unknown>);
assertNoSupplierKeys(clientRows, "client-sample");
const sampleText = JSON.stringify({
  catalog: { products: clientRows.slice(0, 24) },
  search: { listing: { products: clientRows.slice(24, 48) } },
  product: clientRows[0],
});
for (const needle of bannedHits(sampleText)) fail(`client-sample contains ${JSON.stringify(needle)}`);

const flow = catalog.find((product) => product.code === "CJFZENS2723");
if (!flow) fail("missing local row used to check the Flow line");
else if (productLineLabel(flow.item) !== "Flow") fail("Flow line label drifted");

const kidsSet = productLineLabel("JOMA KIDS SET VIOLET");
if (kidsSet !== "Kids Set" || SUPPLIER_TOKEN.test(kidsSet)) {
  fail(`kids set line label drifted: ${kidsSet}`);
}
if (productLineLabel("") !== "") fail("empty item must produce an empty line");
if (productLineLabel("   ") !== "") fail("blank item must produce an empty line");
for (const [source, expected] of LINE_CASES) {
  const line = productLineLabel(source);
  if (line !== expected) fail(`line label drifted for ${JSON.stringify(source)}: ${JSON.stringify(line)}`);
  assertPublicLine(line, `label ${JSON.stringify(source)}`);
}
for (const product of catalog) {
  assertPublicLine(productLineLabel(product.item), `catalog ${product.code}`);
}

function scanText(file: string, text: string) {
  for (const needle of bannedHits(text)) {
    fail(`${file} contains ${JSON.stringify(needle)}`);
  }
  if (STRING_KEY.test(text)) fail(`${file} contains a supplier field string`);
  STRING_KEY.lastIndex = 0;
  const lineRe = new RegExp(LINE_VALUE.source, "gi");
  let match: RegExpExecArray | null;
  while ((match = lineRe.exec(text))) {
    assertPublicLine(match[1] ?? "", file);
  }
}

if (!existsSync(staticDir)) {
  fail(`missing build output ${staticDir}`);
} else {
  const files: string[] = [];
  walk(staticDir, files);
  if (!files.length) fail("no built client chunks");
  for (const file of files) scanText(file, readFileSync(file, "utf8"));
  console.log(`scanned ${files.length} client files under .next/static`);
}

const appDir = join(root, ".next", "server", "app");
if (existsSync(appDir)) {
  const pages: string[] = [];
  const collect = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      const stat = statSync(path);
      if (stat.isDirectory()) collect(path);
      else if (/\.(html|rsc)$/.test(name)) pages.push(path);
    }
  };
  collect(appDir);
  for (const file of pages) scanText(file, readFileSync(file, "utf8"));
  console.log(`scanned ${pages.length} prerendered pages`);
}

if (failed) {
  console.error(`${failed} supplier-field check(s) failed`);
  process.exit(1);
}

console.log(
  `ok listing-index ${listing.length} rows, client sample ${clientRows.length} rows, no supplier line fields, no line ending in a separator`,
);
