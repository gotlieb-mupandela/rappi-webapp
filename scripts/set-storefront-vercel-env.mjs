import fs from "fs";
import { spawnSync } from "child_process";
import path from "path";

const ROOT = process.cwd();
const envPath = path.join(ROOT, ".env.local");
const vercelBin = process.env.VERCEL_BIN || "npx";

function parseEnv(text) {
  /** @type {Record<string, string>} */
  const out = {};
  for (const line of text.split(/\r?\n/)) {
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 1) continue;
    let v = line.slice(eq + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    out[line.slice(0, eq)] = v;
  }
  return out;
}

function vercel(args, input) {
  const binArgs = vercelBin === "npx" ? ["vercel", ...args] : args;
  const result = spawnSync(vercelBin, binArgs, {
    cwd: ROOT,
    input,
    encoding: "utf8",
    env: process.env,
    shell: process.platform === "win32",
  });
  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || "vercel failed").trim());
  }
  return result.stdout || "";
}

const env = parseEnv(fs.readFileSync(envPath, "utf8"));
const vars = [
  { key: "NEXT_PUBLIC_META_PIXEL_ID", sensitive: false },
  { key: "NEXT_PUBLIC_CONTACT_EMAIL", sensitive: false },
  { key: "NEXT_PUBLIC_WHATSAPP_NUMBER", sensitive: false },
  { key: "META_CATALOG_FEED_TOKEN", sensitive: true },
];

for (const { key, sensitive } of vars) {
  const value = env[key];
  if (!value) {
    console.error("missing", key, "in .env.local");
    process.exit(1);
  }
  const flags = [
    "env",
    "add",
    key,
    "production,preview,development",
    sensitive ? "--sensitive" : "--no-sensitive",
    "--force",
    "--yes",
    "--non-interactive",
  ];
  vercel(flags, value + "\n");
  console.log(key, "set for production, preview, development");
}
