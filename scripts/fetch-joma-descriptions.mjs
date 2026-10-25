#!/usr/bin/env node
/**
 * Pull official Joma PDP descriptions for hub SKUs (default: rugby).
 * Writes data/joma-descriptions.json. Does not invent copy — missing pages are skipped.
 *
 *   node scripts/fetch-joma-descriptions.mjs
 *   node scripts/fetch-joma-descriptions.mjs --codes 104384.200,400680.209
 */
import dns from "node:dns";
import fs from "node:fs";
import path from "node:path";

dns.setDefaultResultOrder("ipv4first");

const root = path.resolve(import.meta.dirname, "..");
const catalog = JSON.parse(fs.readFileSync(path.join(root, "data", "products.json"), "utf8"));
const dest = path.join(root, "data", "joma-descriptions.json");
const existing = fs.existsSync(dest) ? JSON.parse(fs.readFileSync(dest, "utf8")) : {};

const codesArg = process.argv.find((a) => a.startsWith("--codes"));
const explicit = codesArg
  ? (codesArg.includes("=") ? codesArg.split("=")[1] : process.argv[process.argv.indexOf(codesArg) + 1])
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  : null;

const rugby = catalog.filter((p) => p.category === "rugby" || p.hubs?.includes("rugby")).map((p) => p.code);
const codes = explicit ?? rugby;

const CONCURRENCY = 6;
const TIMEOUT_MS = 20000;

function decodeEntities(text) {
  return text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&[a-z]+;/gi, " ");
}

function extractDescription(html) {
  const block = html.match(
    /<h2>\s*Description\s*<\/h2>\s*<div class="Textcollapse">([\s\S]*?)<\/div>/i,
  );
  if (!block) return "";
  let raw = block[1]
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<p[^>]*>/gi, "")
    .replace(/<[^>]+>/g, " ");
  raw = decodeEntities(raw);
  return raw.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").replace(/[ \t]{2,}/g, " ").trim();
}

async function fetchLocale(code, locale) {
  const url = `https://www.joma-sport.com/${locale}/${code}.html`;
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: ac.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; RappiCatalog/1.0)" },
      redirect: "follow",
    });
    if (!res.ok) return "";
    const html = await res.text();
    return extractDescription(html);
  } catch {
    return "";
  } finally {
    clearTimeout(t);
  }
}

async function pool(items, n, fn) {
  const out = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx], idx);
    }
  }
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, worker));
  return out;
}

const next = { ...existing };
let found = 0;
let missing = 0;

await pool(codes, CONCURRENCY, async (code) => {
  const [en, fr] = await Promise.all([fetchLocale(code, "en"), fetchLocale(code, "fr")]);
  if (!en && !fr) {
    missing += 1;
    process.stdout.write(`miss ${code}\n`);
    return;
  }
  next[code] = {
    ...(en ? { en } : {}),
    ...(fr ? { fr } : {}),
  };
  found += 1;
  process.stdout.write(`ok ${code} en=${en.length} fr=${fr.length}\n`);
});

fs.writeFileSync(dest, `${JSON.stringify(next, null, 2)}\n`);
console.log(JSON.stringify({ wrote: dest, codes: codes.length, found, missing, stored: Object.keys(next).length }));
