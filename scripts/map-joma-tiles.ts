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
const tiles = (JSON.parse(readFileSync(src, "utf8")) as JomaTile[]).filter(
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
};
const alias = (v: string) => ALIASES[v.trim().toLowerCase()] ?? v;
const norm = (v: string) =>
  alias(v)
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/\b(the|and|y)\b/g, " ")
    .replace(/[^a-z0-9]+/g, "")
    .replace(/s\b/g, "");
const parentOf = (p: string) => p.split(" > ").slice(0, -1).map(norm).join(">");

const byPath = new Map<string, JomaTile>();
for (const t of tiles) {
  const key = `${parentOf(t.path)}|${norm(t.label)}`;
  if (!byPath.has(key)) byPath.set(key, t);
}
const findUnder = (parent: string[], label: string) =>
  byPath.get(`${parent.map(norm).join(">")}|${norm(label)}`);
/** Same label anywhere below the given parent (crawler sometimes nests one deeper). */
const findBelow = (parent: string[], label: string) => {
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

async function main() {
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
