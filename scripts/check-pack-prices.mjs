#!/usr/bin/env node
/**
 * Guardrail for the pack-retail policy (code/data only, no supplier fetch).
 *
 * Driven by data/b2c-price-fix-data.json + data/b2c-map-b.json:
 * - every pack_price_overrides row: catalog.price == pack_nad (literal),
 *   hidden rows stay available === false, live rows stay purchasable and
 *   match the public listing index (flags carried for client render).
 * - baked displayName/title carry no pack suffix (render localizes it).
 * - every hidden_packs row: available === false and absent from the index.
 * - every MAP B row: catalog + index price == snapped NAD.
 * - no unit-NAD leftovers on mapped codes, FX/markup unchanged (18 / 0.45).
 */
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const catalogPath = path.join(root, "data", "products.json");
const listingPath = path.join(root, "public", "listing-index.json");
const markupPath = path.join(root, "data", "retail-markup.json");
const fixPath = path.join(root, "data", "b2c-price-fix-data.json");
const mapBPath = path.join(root, "data", "b2c-map-b.json");

// Unit-retail NAD that must never reappear as a selling price on mapped codes.
// (783 excluded: it is the legitimate pack NAD for 101686.* bibs.)
const UNIT_NAD = new Set([215, 117, 176, 98, 78, 128, 74, 64]);

function fail(msg) {
  console.error(`FAIL ${msg}`);
  process.exitCode = 1;
}

const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
const listing = JSON.parse(fs.readFileSync(listingPath, "utf8"));
const byCode = new Map(catalog.map((p) => [p.code, p]));
const listingByCode = new Map(listing.map((p) => [p.code, p]));
const fix = JSON.parse(fs.readFileSync(fixPath, "utf8"));
const hidden = new Set((fix.hidden_packs || []).map((s) => s.code));

function titleWording(o) {
  // Bake stores locale-neutral base names: no EN pack suffix may be baked
  // into displayName/title (render adds it per locale via packTitleSuffix).
  const p = byCode.get(o.code);
  for (const field of [p.displayName, p.title]) {
    if (/\s*·\s*(pack of \d+|pack|assortment pack|multipack)\s*$/i.test(field || "")) {
      fail(`${o.code} baked EN pack suffix in title`);
    }
  }
  // ...but multipack wording must still be discoverable in the base name.
  if (o.sell_as === "multipack") {
    const hay = [p.displayName, p.title, p.name].join(" ");
    if (!/\bmultipack\b/i.test(hay)) fail(`${o.code} base name missing Multipack`);
  }
}

// Pack overrides: literal pack NAD, correct availability, index + titles.
for (const o of fix.pack_price_overrides || []) {
  const p = byCode.get(o.code);
  if (!p) {
    fail(`missing pack SKU ${o.code}`);
    continue;
  }
  if (p.price !== o.pack_nad || p.unitPrice !== o.pack_nad) {
    fail(`${o.code} price ${p.price}/${p.unitPrice}, expected pack NAD ${o.pack_nad}/${o.pack_nad}`);
  }
  if (!Number.isInteger(p.price)) fail(`${o.code} non-integer NAD`);
  if (UNIT_NAD.has(p.price)) fail(`${o.code} still at unit NAD ${p.price}`);
  if (o.sell_as && p.sellAs !== o.sell_as) {
    fail(`${o.code} sellAs ${p.sellAs}, expected ${o.sell_as}`);
  }
  if (o.pack_size && o.pack_size > 1 && p.packSize !== o.pack_size) {
    fail(`${o.code} packSize ${p.packSize}, expected ${o.pack_size}`);
  }
  if (hidden.has(o.code)) {
    if (p.available !== false) fail(`${o.code} should stay hidden`);
    if (listingByCode.has(o.code)) fail(`${o.code} still appears in public listing index`);
    continue;
  }
  if (p.available === false) fail(`${o.code} should be purchasable at pack NAD ${o.pack_nad}`);
  const indexed = listingByCode.get(o.code);
  if (!indexed) fail(`${o.code} missing from public listing index`);
  else {
    if (indexed.price !== o.pack_nad || indexed.unitPrice !== o.pack_nad) {
      fail(`${o.code} listing price ${indexed.price}/${indexed.unitPrice}, expected ${o.pack_nad}/${o.pack_nad}`);
    }
    // Client render needs the flags (badge/title localize from these).
    if (o.sell_as && indexed.sellAs !== o.sell_as) {
      fail(`${o.code} listing missing sellAs=${o.sell_as}`);
    }
    if (o.pack_size && o.pack_size > 1 && indexed.packSize !== o.pack_size) {
      fail(`${o.code} listing missing packSize=${o.pack_size}`);
    }
  }
  titleWording(o);
}

// Hidden packs: never purchasable, never indexed.
for (const s of fix.hidden_packs || []) {
  const p = byCode.get(s.code);
  if (!p) {
    console.log(`info hidden pack missing in catalog ${s.code}`);
    continue;
  }
  if (p.available !== false) fail(`hidden pack ${s.code} still available at ${p.price}`);
  if (listingByCode.has(s.code)) fail(`hidden pack ${s.code} still appears in public listing index`);
}

// MAP B off-by-1 snaps: catalog + index must carry the exact integers.
const mapB = JSON.parse(fs.readFileSync(mapBPath, "utf8"));
let mapBChecked = 0;
for (const [code, nad] of Object.entries(mapB.prices)) {
  const p = byCode.get(code);
  if (!p) {
    fail(`MAP B SKU missing in catalog ${code}`);
    continue;
  }
  if (p.price !== nad || p.unitPrice !== nad) {
    fail(`MAP B ${code} price ${p.price}/${p.unitPrice}, expected ${nad}/${nad}`);
  }
  const indexed = listingByCode.get(code);
  if (indexed && (indexed.price !== nad || indexed.unitPrice !== nad)) {
    fail(`MAP B ${code} listing ${indexed.price}/${indexed.unitPrice}, expected ${nad}/${nad}`);
  }
  mapBChecked++;
}
if (mapBChecked !== mapB.count) fail(`MAP B checked ${mapBChecked}, expected ${mapB.count}`);

// Former footwear-threshold SKUs: no baked Assortment/Pack size-run wording
// (render localizes it); pack sizes recorded as flags, not invented.
for (const [code, n, nad] of [["RR500W2602", 8, 12236], ["BF111JS2629V", 12, 5716]]) {
  const p = byCode.get(code);
  if (!p) {
    fail(`missing SKU ${code}`);
    continue;
  }
  // Baked base names stay neutral; pack counts live in flags for render.
  const hay = [p.displayName, p.title, p.name].join(" ");
  if (/assortment pack|pack of \d+|\bmultipack\b|wholesale assortment|size run/i.test(hay)) {
    fail(`${code} still shows assortment/pack wording`);
  }
  if (p.sellAs !== "assortment" || p.packSize !== n) {
    fail(`${code} flags sellAs=${p.sellAs} packSize=${p.packSize}, expected assortment/${n}`);
  }
  if (p.price !== nad || p.unitPrice !== nad) {
    fail(`${code} price ${p.price}/${p.unitPrice}, expected confirmed live NAD ${nad}/${nad}`);
  }
  if (p.available === false) fail(`${code} should stay purchasable`);
}

// sell_as=assortment allowlist: supplier-confirmed Surtido footwear
// (237, pack sizes recorded, no price heuristic) plus pre-existing
// non-footwear packs. Anything else carrying the flag fails.
const ASSORTMENT_ALLOWLIST = new Set([
  "400245.P04", "400300.P04", "AH41800B0501", "BF111JS2629V", "BF111JW2601V", "BF111JW2612V", "BF111JW2624V", "BF1448LW2512",
  "BF1448W2503", "BF1448W2512", "BF1448W2624", "BF144JW2512V", "BF144JW2526V", "BFCAKJW2513", "BFCAKJW2515", "BFCALJS2613V",
  "BFCALJS2625V", "BFCALJW2520V", "BFCALJW2626V", "BFCALLS2613", "BFCALLW2520", "BFCALLW2625", "BFCOCJW2503V", "BFCOCJW2524V",
  "BFCROJW2628V", "BFDEGJW2605V", "BFDEGJW2613V", "BFFENS2602", "BFFLEJS2613", "BFFLEJW2624V", "BFFLELS2613", "BFFLELW2502",
  "BFFLELW2529", "BFFLEXS2612", "BFFLEXS2625", "BFMUNJS2611V", "BFR111W2601", "BFR111W2626", "BFR50JW2513V", "BFRT50W2624",
  "BFSCROW2602", "BFSIEJW2601V", "BFSIEW2615", "BFSIMJS2631V", "BFSIMS2628", "BFVIPEW2507", "BFVIPEW2603", "BFVIPJS2603",
  "BFVIPJS2610", "BFVIPJS2610V", "BFVIPJW2616", "BFVIPJW2616V", "BFVIPJW2620", "BFVIPJW2620V", "BFYARW2513", "C1448LW2613",
  "C1992LS2626", "C448LW2612", "C448LW2625", "C448LW2626", "C448W2612", "C448W2624", "C512LS2625", "C520LS2602",
  "C520LS2615", "C520LS2629", "C521LW2603", "C521LW2629", "C521S2603", "C521S2623", "C521W2601", "C521W2612",
  "C521W2617", "C618W2603", "CALLLW2603", "CALLLW2613", "CALLLW2625", "CANS2627IN", "CANS2628IN", "CATOW2621",
  "CATOW2624", "CAURLW2603", "CAURLW2621", "CBRILW2601", "CBRILW2602", "CBRILW2603", "CBRILW2635", "CCARLW2601",
  "CCARLW2624", "CCARLW2625", "CCASLW2601", "CCASLW2613", "CCASLW2625", "CCORLS2605", "CCORS2612H", "CCORW2603",
  "CDOVEW2603", "CDOVEW2625", "CDRAKW2603", "CEROW2603", "CEROW2612", "CEROW2621", "CGALLW2621", "CGALLW2625",
  "CHEOW2621", "CHEOW2622", "CIRONW2603", "CKRUMW2603", "CLAILW2621", "CLAILW2626", "CLAILW2629", "CMARW2624",
  "CMORLW2601", "CN10LS2625", "CN40LW2621V", "CNADLW2601", "CNADLW2625", "CNADLW2626", "CNEROW2603", "CNEROW2621",
  "CNEROW2625", "CORIGLS2612", "COSIRS2623", "COSIRW2603", "CR111LS2602", "CR111LS2625", "CR111LW2624", "CR111LW2630",
  "CR111W2622", "CRAYW2621", "CRAYW2634", "CRODEW2623", "CRODEW2624", "CSARLW2601", "CSARLW2603", "CSARLW2625",
  "CSELES2603", "CSELES2621", "CSINLW2613", "CTABW2624", "CTAVLW2601", "CTAVLW2629", "CTESES2605", "CTESES2621",
  "CTESES2625", "CTESEW2612", "CTESEW2624", "CTRITW2603", "CTRITW2623", "CTRITW2624", "CZENS2621", "CZNDLW2621",
  "CZNDLW2625", "JAQUIS2601V", "JAQUIS2603V", "JATILW2601V", "JATILW2603V", "JATILW2604V", "JATILW2633V", "JNOVAS2607V",
  "JRT50S2602", "JRT50S2603", "JRT50S2699", "JSPACW2605V", "JSPACW2613V", "RACTIW2633", "RFENIW2615", "RFENIW2624",
  "RFENIW2631", "RHISPW2609", "RHISPW2625", "RMETAW2601", "RMETAW2603", "RMETLW2629", "RNEOW2603", "RNEOW2623",
  "RNEOW2625", "RR500W2602", "RRT50LS2603", "RRT50LS2612", "RRT50LS2626", "RRT50LW2612", "RRT50LW2625", "RRT50W2601",
  "RRT50W2625", "RSCROW2602", "RSCROW2627", "RSCROW2641", "RSPEEW2605", "RSPEEW2607", "RSPEEW2630", "RVICTW2604",
  "RVICTW2607", "RVICTW2612", "RVICTW2632", "RVITAW2633", "SAMALS2601V", "SAMALS2629V", "SLIBLS2615V", "SLIBS2623V",
  "SNEOJS2617V", "TACELS2613AC", "TACELS2613C", "TACELS2632AC", "TACES2608AC", "TACLW2602AC", "TACLW2602C", "TACLW2627AC",
  "TACLW2627C", "TELCS2632AC", "TELECW2603AC", "TELECW2603C", "TI41800B5101", "TKKUBW2601", "TKRASW2601", "TKRASW2625",
  "TKSHLW2609", "TKSILW2601", "TKSIMW2601", "TKSMLW2601", "TKSMLW2610", "TKTR5S2617", "TKTR6S2617", "TKTR6W2601",
  "TKTR8S2617", "TKTR9S2617", "TKTULW2625", "TM100W2605C", "TM10LS2601C", "TM10LW2601C", "TM10LW2602C", "TPOIS2601AC",
  "TPOIS2601C", "TPOIS2604AC", "TPOIS2604C", "TPOIS2625AC", "TPOIS2625C", "TRALS2602AC", "TROLLS2625AC", "TROLLS2625C",
  "TROLS2603AC",
]);
for (const p of catalog) {
  if (p.sellAs === "assortment" && !ASSORTMENT_ALLOWLIST.has(p.code)) {
    fail(`${p.code} unexpected sellAs=assortment`);
  }
}

// No-EN-bake regression net: bake stores neutral base names, so no baked
// displayName/title may end with a pack suffix in any language. Render adds
// the wording per locale via packTitleSuffix.
for (const p of catalog) {
  for (const field of [p.displayName, p.title]) {
    if (/\s*·\s*(pack of \d+|pack|assortment pack|multipack)\s*$/i.test(field || "")) {
      fail(`${p.code} baked EN pack suffix in title`);
    }
  }
}

// No unavailable catalog row should leak into any public browse index.
for (const p of catalog) {
  if (p.available === false && listingByCode.has(p.code)) {
    fail(`unavailable ${p.code} still appears in public listing index`);
  }
}
for (const p of listing) {
  if (p.available === false) fail(`listing index contains unavailable ${p.code}`);
}

// Headline regression asserts from the task verify matrix.
for (const [code, nad] of [
  ["400855.220", 9396],
  ["401955.215", 2584],
  ["401955.216", 2584],
  ["401955.217", 2584],
  ["400089.100", 2819],
  ["400089.200", 2819],
  ["400056.100", 1762],
  ["400360.100", 1409],
  ["101686.010", 783],
  ["101686.200", 783],
  ["400356.308", 3758],
  ["TI41800B5101", 3495],
]) {
  const p = byCode.get(code);
  if (!p) fail(`missing SKU ${code}`);
  else if (p.price !== nad) fail(`${code} price ${p.price}, expected pack NAD ${nad}`);
}

// FX / markup unchanged
const markup = JSON.parse(fs.readFileSync(markupPath, "utf8"));
if (Number(markup.fx) !== 18 || Number(markup.markup) !== 0.45) {
  fail(`retail-markup changed: fx=${markup.fx} markup=${markup.markup}, expected 18/0.45`);
}

if (process.exitCode) {
  console.error("pack-price guardrail FAILED");
} else {
  console.log(
    `ok pack-price guardrail: ${(fix.pack_price_overrides || []).length} pack overrides + ${mapBChecked} MAP B snaps + hidden SKUs absent from index + fx/markup 18/0.45`,
  );
}
