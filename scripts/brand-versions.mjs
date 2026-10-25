/**
 * Writes data/brand-versions.json: a short content hash per file in public/brand.
 * Replacing a picture under the same name then gets a new hash on the next build.
 */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const BRAND_DIR = path.join(ROOT, "public", "brand");
const OUT_DIR = path.join(ROOT, "data");
const OUT_FILE = path.join(OUT_DIR, "brand-versions.json");

function shortHash(bytes) {
  return createHash("sha1").update(bytes).digest("hex").slice(0, 12);
}

/** @returns {Record<string, string>} */
function hashesFromDisk() {
  /** @type {Record<string, string>} */
  const versions = {};
  let files = [];
  try {
    files = readdirSync(BRAND_DIR);
  } catch {
    return versions;
  }
  for (const name of files) {
    if (name.startsWith(".")) continue;
    const bytes = readFileSync(path.join(BRAND_DIR, name));
    versions[`/brand/${name}`] = shortHash(bytes);
  }
  return versions;
}

/** Fallback when public/brand is not checked out (sparse clone). */
function hashesFromGit() {
  /** @type {Record<string, string>} */
  const versions = {};
  try {
    const out = execFileSync("git", ["ls-tree", "-r", "HEAD", "public/brand"], {
      cwd: ROOT,
      encoding: "utf8",
    });
    for (const line of out.split(/\r?\n/)) {
      const match = /^[0-9]+ blob ([0-9a-f]+)\tpublic\/brand\/(.+)$/.exec(line);
      if (!match) continue;
      versions[`/brand/${match[2]}`] = match[1].slice(0, 12);
    }
  } catch {
    return versions;
  }
  return versions;
}

const versions = { ...hashesFromGit(), ...hashesFromDisk() };
mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(OUT_FILE, `${JSON.stringify(versions, null, 2)}\n`);
console.log(`Wrote ${Object.keys(versions).length} brand versions to data/brand-versions.json`);
