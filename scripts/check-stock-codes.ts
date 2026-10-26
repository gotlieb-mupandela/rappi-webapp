import assert from "node:assert/strict";
import {
  STOCK_CODE_LIMIT,
  STOCK_CODE_MAX_LENGTH,
  lookupStockCodes,
  parseStockCodes,
} from "../lib/stock-codes";

function parsed(input: string | URLSearchParams) {
  const params = typeof input === "string" ? new URLSearchParams(input) : input;
  return parseStockCodes(params);
}

function codesOf(input: string | URLSearchParams) {
  return parsed(input).codes;
}

let failed = 0;

function check(name: string, fn: () => void) {
  try {
    fn();
    console.log(`ok ${name}`);
  } catch (err) {
    failed += 1;
    console.error(`FAIL ${name}`);
    console.error(err);
  }
}

check("repeated code keeps a comma and a slash", () => {
  assert.deepEqual(codesOf("code=946%2C001&code=709%2F101"), ["946,001", "709/101"]);
});

check("live codes via repeated code", () => {
  const live = ["709/101", "711/101", "946,001", "946,003", "TEAM/14"];
  const params = new URLSearchParams();
  for (const code of live) params.append("code", code);
  const once = live.map((code) => `code=${encodeURIComponent(code)}`).join("&");
  assert.equal(params.toString(), once);
  assert.equal(
    params.toString(),
    "code=709%2F101&code=711%2F101&code=946%2C001&code=946%2C003&code=TEAM%2F14",
  );
  assert.deepEqual(codesOf(params), live);
  assert.deepEqual(lookupStockCodes(parsed(params)), live);
});

check("legacy codes query splits after percent-decoding", () => {
  assert.deepEqual(codesOf("codes=709%2F101,946%2C001"), ["709/101", "946", "001"]);
});

check("repeated codes is not a list of separate codes", () => {
  assert.deepEqual(codesOf("codes=946%2C001&codes=709%2F101"), ["946", "001"]);
});

check("empty input", () => {
  assert.deepEqual(codesOf(""), []);
  assert.deepEqual(codesOf("codes="), []);
  assert.deepEqual(codesOf("code="), []);
  assert.deepEqual(codesOf("code=&codes=,,,"), []);
  assert.deepEqual(lookupStockCodes(parsed("")), []);
});

check("trims, drops empties, and removes duplicates", () => {
  const params = new URLSearchParams();
  params.append("code", "  946,001 ");
  params.append("code", "946,001");
  params.append("code", " TEAM/14 ");
  const legacy = ["TEAM/14", "709/101"].join(",");
  const query = `${params.toString()}&codes=${encodeURIComponent(legacy)}`;
  assert.deepEqual(codesOf(query), ["946,001", "TEAM/14", "709/101"]);
});

check("51 distinct repeated params keep the first 50", () => {
  const params = new URLSearchParams();
  const all = Array.from({ length: 51 }, (_, i) => `C${String(i).padStart(2, "0")}`);
  for (const code of all) params.append("code", code);
  const result = codesOf(params);
  assert.equal(STOCK_CODE_LIMIT, 50);
  assert.equal(result.length, 50);
  assert.deepEqual(result, all.slice(0, 50));
});

check("mixed legacy and repeated codes share one cap", () => {
  const repeated = Array.from({ length: 40 }, (_, i) => `R${String(i).padStart(2, "0")}`);
  const legacy = [
    ...repeated.slice(30),
    ...Array.from({ length: 30 }, (_, i) => `L${String(i).padStart(2, "0")}`),
  ];
  const params = new URLSearchParams();
  for (const code of repeated) params.append("code", code);
  const query = `${params.toString()}&codes=${encodeURIComponent(legacy.join(","))}`;
  const result = codesOf(query);
  assert.equal(result.length, 50);
  assert.equal(new Set(result).size, 50);
  assert.deepEqual(result.slice(0, 40), repeated);
  assert.deepEqual(
    result.slice(40),
    Array.from({ length: 10 }, (_, i) => `L${String(i).padStart(2, "0")}`),
  );
  assert.equal(result.filter((code) => code === "R30").length, 1);
  assert.equal(result.includes("L10"), false);
});

check("66 character code inside the cap is not looked up", () => {
  const long = "A".repeat(66);
  assert.equal(STOCK_CODE_MAX_LENGTH, 65);
  assert.equal(long.length, 66);
  const params = new URLSearchParams();
  params.append("code", long);
  params.append("code", "TEAM/14");
  const result = parsed(params);
  assert.deepEqual(result.codes, [long, "TEAM/14"]);
  assert.deepEqual(result.overLength, [long]);
  assert.deepEqual(lookupStockCodes(result), ["TEAM/14"]);
  assert.equal(result.codes[0], long);
});

check("65 character code is accepted", () => {
  const code = "B".repeat(65);
  const params = new URLSearchParams();
  params.append("code", code);
  const result = parsed(params);
  assert.deepEqual(result.codes, [code]);
  assert.deepEqual(result.overLength, []);
  assert.deepEqual(lookupStockCodes(result), [code]);
});

check("66 character code past the cap is ignored", () => {
  const params = new URLSearchParams();
  for (let i = 0; i < 50; i += 1) params.append("code", `S${i}`);
  const long = "C".repeat(66);
  params.append("code", long);
  const result = parsed(params);
  assert.equal(result.codes.length, 50);
  assert.deepEqual(result.overLength, []);
  assert.equal(result.codes.includes(long), false);
  assert.deepEqual(lookupStockCodes(result), result.codes);
});

check("TEAM/14 is kept", () => {
  assert.deepEqual(codesOf("code=TEAM%2F14"), ["TEAM/14"]);
  assert.deepEqual(codesOf("codes=TEAM/14"), ["TEAM/14"]);
});

if (failed) {
  console.error(`${failed} stock code check(s) failed`);
  process.exit(1);
}

console.log("stock code checks ok");
