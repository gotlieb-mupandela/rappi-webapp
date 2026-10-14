/**
 * Map our folder / landing tiles to Joma B2B (joma-sport.net) folder tiles and
 * host Joma's exact tile image (unedited bytes) in public/joma-tiles/.
 * Re-runnable: npx tsx scripts/map-joma-tiles.ts [/workspace/joma_net/folder_tiles.json]
 * Writes data/joma-tile-images.json and data/joma-tile-unmatched.json.
 */
import { createHash } from "crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import {
  APPAREL_FOLDERS,
  FOOTWEAR_FOLDERS,
  KIDS_APPAREL_FOLDERS,
  KIDS_FOOTWEAR_FOLDERS,
  WOMAN_APPAREL_FOLDERS,
  type JomaFolderDef,
} from "../lib/joma-tree";
import {
  jomaAccessoriesLandingTiles,
  jomaAudienceLandingTiles,
  jomaFootwearLandingTiles,
  jomaKidsLandingTiles,
  jomaOfficialKitsLandingTiles,
  jomaOutletLandingTiles,
  jomaTeamsLandingTiles,
} from "../lib/joma-nav";

type JomaTile = { path: string; label: string; image_url: string };
const src = process.argv[2] ?? "/workspace/joma_net/folder_tiles.json";
const decode = (v: string) =>
  v
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
const rows = (JSON.parse(readFileSync(src, "utf8")) as JomaTile[]).map((t) =>
  t && typeof t.path === "string" && typeof t.label === "string"
    ? { ...t, path: decode(t.path), label: decode(t.label) }
    : t,
);
const dedupe = new Set<string>();
const tiles = rows.filter((t) => {
  if (!t || typeof t.path !== "string" || typeof t.label !== "string") return false;
  const k = `${t.path}|${t.label}|${t.image_url}`;
  if (dedupe.has(k)) return false;
  dedupe.add(k);
  return true;
}).filter(
  (t) =>
    /^https?:\/\//.test(t.image_url) &&
    !/no-image/i.test(t.image_url) &&
    !/available until|special offers|last season|^\d{8}_/i.test(t.label),
);

/** Our label → Joma portal label (same folder, different wording). */
const ALIASES: Record<string, string> = {
  "training polyester": "polyester",
  "training cotton": "cotton",
  portero: "goalie",
  entrenador: "coach",
  arbitro: "referee",
  "12 - 14 years boy": "12-14 year old boy",
  "12 - 14 years girl": "12-14 year old girl",
  "1 - 4 years": "1-4 years",
  "6 - 10 years": "6-10 years",
  men: "man",
  women: "woman",
  kids: "junior",
  "gloves portero": "goalkeeper gloves",
  medias: "socks",
  "accessories teamwear": "teamwear accessories",
  "accessories running": "running accessories",
  "accessories of racket": "racket accessories",
  "accessories outdoor": "outdoor accessories",
  "accessories fitness / gym": "fitness / gym accessories",
  "accessories tiendas": "accessories stores",
  "teamwear catalogue": "teamwear catalogue 2025",
  "athletes / combat": "atheletes / combat",
  cycling: "cycling / triathlon",
  "running / trailrunning": "running / trail",
  flow: "joma flow",
  intimi: "intimate",
  confort: "comfort",
  "sandals confort": "comfort sandals",
  "chubasqueros/windbreakers": "raincoats/windbreakers",
  chubasqueros: "raincoats",
  "anoracks/jackets": "anoraks/jackets",
  básicos: "basics",
  basicos: "basics",
  "pants corto": "shorts",
  "pants cortos": "shorts",
  "pants largo": "long pants",
  "pants largos": "long pants",
  árbitro: "referee",
  portera: "goalie",
  "football / futsal": "soccer / futsal",
  "football/futsal": "soccer / futsal",
  football: "soccer",
  colegial: "schoolboy",
  "kansas set (reversible)": "kansas set",
  outwear: "outerwear",
  "teamwer collections": "teamwear collections",
  "skirts & pants": "skirts & trousers",
  "previous season": "previous seasons",
};
const alias = (v: string) => ALIASES[v.trim().toLowerCase()] ?? v;
const norm = (v: string) =>
  alias(v)
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/\b(the|and|y)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .map((w) => w.replace(/s$/, ""))
    .join("");
/** Crawl rows carry either the tile's own path (ending in its label) or the page path it sits on. */
const parentOf = (p: string, label: string) => {
  const parts = p.split(" > ");
  const own = norm(parts[parts.length - 1] ?? "") === norm(label);
  return (own ? parts.slice(0, -1) : parts).map(norm).join(">");
};

const byPath = new Map<string, JomaTile>();
for (const t of tiles) {
  const key = `${parentOf(t.path, t.label)}|${norm(t.label)}`;
  if (!byPath.has(key)) byPath.set(key, t);
}
const findUnder = (parent: string[], label: string) =>
  byPath.get(`${parent.map(norm).join(">")}|${norm(label)}`);
/** Same label anywhere below the given parent, widening one level at a time (min Home > X > Y). */
const findBelow = (parent: string[], label: string) => {
  for (let n = parent.length; n >= Math.min(3, parent.length); n--) {
    const hit = findBelowExact(parent.slice(0, n), label);
    if (hit) return hit;
  }
  return undefined;
};
const findBelowExact = (parent: string[], label: string) => {
  const pre = parent.map(norm).join(">");
  for (const [key, t] of byPath) {
    const [p, l] = key.split("|");
    if (l === norm(label) && (p === pre || p.startsWith(pre + ">"))) return t;
  }
  return undefined;
};

const out: Record<string, string> = {};
const matched: Record<string, string> = {};
const unmatched: string[] = [];
const publicDir = path.join(process.cwd(), "public/joma-tiles");
mkdirSync(publicDir, { recursive: true });

function want(key: string, hit: JomaTile | undefined, ours: string) {
  if (!hit) {
    unmatched.push(`${key} (${ours})`);
    return;
  }
  const ext = (hit.image_url.split("?")[0].match(/\.(jpe?g|png|webp|gif)$/i)?.[1] ?? "jpg").toLowerCase();
  const name = `${createHash("md5").update(hit.image_url).digest("hex").slice(0, 12)}.${ext}`;
  out[key] = `/joma-tiles/${name}`;
  matched[key] = `${hit.path} <- ${hit.image_url}`;
}

const LANDING: [string, string[], { label: string }[]][] = [
  ["teams", ["Home", "Man", "Teamwear"], jomaTeamsLandingTiles()],
  ["accessories", ["Home", "Accessories"], jomaAccessoriesLandingTiles()],
  ["outlet", ["Home", "Outlet"], jomaOutletLandingTiles().filter((t) => t.kind === "photo")],
  ["footwear", ["Home", "Footwear"], jomaFootwearLandingTiles()],
  ["official-kits", ["Home", "Official Kits"], jomaOfficialKitsLandingTiles()],
  ["men", ["Home", "Man"], jomaAudienceLandingTiles("men")],
  ["women", ["Home", "Woman"], jomaAudienceLandingTiles("women")],
  ["kids", ["Home", "Children"], jomaKidsLandingTiles()],
];
for (const [page, parent, list] of LANDING) {
  for (const t of list) want(`landing:${page}:${t.label}`, findUnder(parent, t.label) ?? findBelow(parent, t.label), t.label);
}

function walk(folders: readonly JomaFolderDef[], parent: string[], seen: Set<string>) {
  for (const f of folders) {
    const key = `folder:${f.key}`;
    if (!seen.has(key)) {
      seen.add(key);
      want(key, findUnder(parent, f.label) ?? findBelow(parent, f.label), [...parent.slice(1), f.label].join(" > "));
    }
    if (f.children?.length) walk(f.children, [...parent, f.label], seen);
  }
}
const seen = new Set<string>();
walk(APPAREL_FOLDERS, ["Home", "Man"], seen);
walk(WOMAN_APPAREL_FOLDERS, ["Home", "Woman"], seen);
walk(KIDS_APPAREL_FOLDERS, ["Home", "Children"], seen);
walk(FOOTWEAR_FOLDERS, ["Home", "Footwear"], seen);
walk(KIDS_FOOTWEAR_FOLDERS, ["Home", "Footwear", "Junior"], seen);

/** HARD RULE: home-page tiles / banners are never touched by this mapping. */
function assertNoHomeKeys(map: Record<string, string>) {
  const bad = Object.keys(map).filter((k) => /^(home|homepage|hero|bento)[:|]/i.test(k) || /^landing:home/i.test(k));
  if (bad.length) throw new Error(`Refusing to map home-page tiles: ${bad.join(", ")}`);
}

/** Level-exact matches from scripts/joma-structure-diff.py win over label search. */
const structurePath = path.join(process.cwd(), "data/joma-portal-structure.json");
if (existsSync(structurePath)) {
  const images = (JSON.parse(readFileSync(structurePath, "utf8")).images ?? {}) as Record<string, string>;
  for (const [key, url] of Object.entries(images)) {
    if (!/^https?:\/\//.test(url) || /no-image/i.test(url)) continue;
    const k = `folder:${key}`;
    want(k, { path: "(portal structure)", label: key, image_url: url }, key);
    const i = unmatched.findIndex((u) => u.startsWith(`${k} `));
    if (i >= 0) unmatched.splice(i, 1);
  }
}

async function main() {
  assertNoHomeKeys(out);
  const urls = new Map<string, string>();
  for (const [key, local] of Object.entries(out)) urls.set(local, matched[key].split(" <- ")[1]);
  for (const [local, url] of urls) {
    const file = path.join(process.cwd(), "public", local);
    if (existsSync(file)) continue;
    const res = await fetch(url, { headers: { "user-agent": "Mozilla/5.0" } }).catch(() => null);
    if (!res?.ok) {
      for (const [key, value] of Object.entries(out)) {
        if (value !== local) continue;
        delete out[key];
        unmatched.push(`${key} (Joma image failed to download: ${url})`);
      }
      continue;
    }
    writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  }
  const sorted = Object.fromEntries(Object.entries(out).sort());
  writeFileSync("data/joma-tile-images.json", JSON.stringify(sorted, null, 1) + "\n");
  writeFileSync(
    "data/joma-tile-unmatched.json",
    JSON.stringify({ matched, unmatched: unmatched.sort() }, null, 1) + "\n",
  );
  console.log(`matched ${Object.keys(out).length}, unmatched ${unmatched.length}, files ${urls.size}`);
}
main();
