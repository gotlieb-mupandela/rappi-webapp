/**
 * data/hidden-pack-codes.json must list the same codes, in the same order,
 * as hidden_packs[].code in data/b2c-price-fix-data.json. The codes file and
 * built client chunks must not contain the hidden pack name "JOMA KIDS SET".
 *
 * Run after npm run build: npx tsx scripts/check-hidden-pack-codes.ts
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import fixData from "../data/b2c-price-fix-data.json";
import codes from "../data/hidden-pack-codes.json";

const FORBIDDEN = "JOMA KIDS SET";
const root = join(import.meta.dirname, "..");

const expected = (fixData.hidden_packs ?? []).map((row) => row.code);
assert.deepEqual(codes, expected, "hidden-pack-codes.json differs from hidden_packs codes");

const codesText = readFileSync(join(root, "data", "hidden-pack-codes.json"), "utf8");
assert.equal(codesText.includes(FORBIDDEN), false, "hidden-pack-codes.json contains JOMA KIDS SET");

function walk(dir: string, out: string[]) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else out.push(path);
  }
}

const staticDir = join(root, ".next", "static");
const files: string[] = [];
try {
  walk(staticDir, files);
} catch {
  throw new Error(".next/static is missing. Run npm run build before this check.");
}

const hits: string[] = [];
for (const file of files) {
  if (!/\.(js|css|json|map|txt|html|mjs|cjs)$/i.test(file)) continue;
  if (readFileSync(file, "utf8").includes(FORBIDDEN)) hits.push(file);
}
assert.deepEqual(hits, [], `client chunks contain ${FORBIDDEN}`);

console.log(`hidden pack codes ok: ${codes.length} codes, no ${FORBIDDEN} in client chunks`);
