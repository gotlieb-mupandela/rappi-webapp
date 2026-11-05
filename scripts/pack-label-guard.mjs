/**
 * Pack-label guard shared by the check script, the catalog import, and stock sync.
 * A style size is S01-S99. One of those, alone, with no pack label, is a suspect
 * unless the code is on data/non-pack-allowlist.json.
 */
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
export const allowlistPath = path.join(root, "data", "non-pack-allowlist.json");
export const apparelAssortmentsPath = path.join(root, "data", "apparel-assortments.json");
export const catalogPath = path.join(root, "data", "products.json");

const STYLE_SIZE = /^S(0[1-9]|[1-9][0-9])$/;
const EU_SHOE_SIZE = /^(?:2[8-9]|[3-4]\d|5[0-2])(?:\.5)?$/;
const SURTIDO_CODE = /^S\d{2}$/i;

export function productText(product) {
  return [product?.displayName, product?.name, product?.title, product?.item, product?.sheetCategory]
    .filter(Boolean)
    .join(" ");
}

function isHeadwear(product) {
  if (product?.subcategory === "caps") return true;
  const text = productText(product);
  if (/\bscrum\b/i.test(text)) return false;
  return /\b(caps?|hats?|visors?|beanies?)\b/i.test(text);
}

function isBall(product) {
  if (product?.subcategory === "balls") return true;
  const text = productText(product);
  if (/\b(bag|backpack|pants)\b/i.test(text)) return false;
  return /\b(balls?|bal[oó]n)\b/i.test(text);
}

function isInferredSurtido(product) {
  const text = productText(product);
  if (
    /\b(bags?|bolsas?|socks?|calcet(?:ines|in)?|bibs?|shirts?|t-shirts?|tees?|polos?|shorts?|bermudas?|jackets?|pants?|tights?|leggings?|hoodies?|gloves?|caps?|hats?|hangers?|masks?|wristbands?|calves|calf)\b/i.test(
      text,
    )
  ) {
    return false;
  }
  if (product.subcategory === "socks" || product.subcategory === "tees") return false;
  const sizes = product.sizeOptions || [];
  if (!sizes.length) return false;
  if (sizes.some((size) => EU_SHOE_SIZE.test(String(size)))) return false;
  if (!sizes.every((size) => SURTIDO_CODE.test(String(size)))) return false;
  if (product.category === "shoes") return true;
  if (/\b(boot|shoe|sneaker|futsal|turf|barefoot|trainer|firm ground|artificial grass|soft ground|indoor|cleat)\b/i.test(text)) {
    return true;
  }
  if (!String(product.code).includes(".") && /^[A-Z]/i.test(String(product.code))) return true;
  return false;
}

/** True when the storefront treats the row as a pack (clientAssortment isPack). */
export function isCatalogPack(product) {
  if (!product) return false;
  const sellAs = product.sellAs;
  if (sellAs === "pack" || sellAs === "assortment" || sellAs === "multipack") return true;
  if (Number(product.packSize) > 1) return true;
  const text = productText(product);
  if (/\bpack(?:\s+of)?\s+\d+\b/i.test(text)) return true;
  if (/\bbox of\s+\d+\b/i.test(text)) return true;
  if (/\bmultipack\b/i.test(text)) return true;
  if (/^105463\./i.test(String(product.code))) return true;
  const price = Number(product.price) || Number(product.unitPrice) || 0;
  if (
    /\beventos\b/i.test(text) &&
    /\b(t-?shirts?|tees?)\b/i.test(text) &&
    !/\b(sack|bag|backpack)\b/i.test(text) &&
    price >= 2000
  ) {
    return true;
  }
  if (/^101686\./i.test(String(product.code))) return true;
  if (
    /\b(training bibs?|petos(?:\s+de\s+entrenamiento|\s+entrenamiento)?)\b/i.test(text) &&
    !/\b(gps bib|crono bib|myskin)\b/i.test(text) &&
    (product.sizeOptions || []).some((size) => /^S0\d$/i.test(String(size)))
  ) {
    return true;
  }
  if ((isHeadwear(product) || isBall(product)) && price >= 1000) return true;
  if (isInferredSurtido(product)) return true;
  return false;
}

export function unlabelledStylePacks(catalog, allowCodes = []) {
  const allow = new Set(allowCodes);
  const suspects = [];
  for (const product of catalog) {
    const sizes = product.sizeOptions || [];
    if (sizes.length !== 1) continue;
    const size = String(sizes[0]).toUpperCase();
    if (!STYLE_SIZE.test(size)) continue;
    if (isCatalogPack(product)) continue;
    if (allow.has(product.code)) continue;
    suspects.push({
      code: product.code,
      size,
      name: product.displayName || product.name || "",
    });
  }
  return suspects;
}

export function missingAssortmentLabels(catalog, rows) {
  const byCode = new Map(catalog.map((product) => [product.code, product]));
  const problems = [];
  for (const row of rows) {
    const product = byCode.get(row.code);
    if (!product) {
      problems.push(`${row.code} is missing from the catalog`);
      continue;
    }
    if (!isCatalogPack(product)) {
      problems.push(`${row.code} does not resolve to a pack`);
      continue;
    }
    if (Number(product.packSize) !== Number(row.pack_size)) {
      problems.push(`${row.code} has ${product.packSize} pieces, expected ${row.pack_size}`);
    }
  }
  return problems;
}

export function loadAllowlist(filePath = allowlistPath) {
  const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
  return Array.isArray(parsed.codes) ? parsed.codes : [];
}

export function formatSuspectList(suspects) {
  return suspects.map((row) => `${row.code}\tsize ${row.size}\t${row.name}`).join("\n");
}
