/**
 * Header subcategory links from the baked nav the header renders.
 * app/layout.tsx passes data/storefront-nav.json into the header.
 * The filter and href match components/category-sub-nav.tsx.
 * This does not read the runtime nav and does not rebuild taxonomy from products.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  CATEGORIES,
  HIDDEN_TYPE_FOLDERS,
  SUBCATEGORY_LABELS,
  TYPE_FOLDERS,
  typeFolderForSubcategory,
} from "../lib/catalog";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const navPath = join(root, "data", "storefront-nav.json");
const outPath = join(root, "data", "storefront-sub-links.json");

export type StorefrontSubLink = {
  hub: string;
  sub: string;
  group: string | null;
  label: string;
  href: string;
  count: number;
};

type BakedTaxonomy = Record<string, Array<{ slug: string; count: number }>>;

export function subLinkTargetId(hub: string, sub: string) {
  return `${hub}--sub-${sub}`;
}

export function storefrontSubLinksFromTaxonomy(taxonomy: BakedTaxonomy): StorefrontSubLink[] {
  const rows: StorefrontSubLink[] = [];
  for (const category of CATEGORIES) {
    const subs = (taxonomy[category.slug] ?? []).filter(
      (sub) => sub.count > 0 && SUBCATEGORY_LABELS[sub.slug] && !HIDDEN_TYPE_FOLDERS.has(sub.slug),
    );
    for (const sub of subs) {
      const folder = typeFolderForSubcategory(sub.slug);
      const group = TYPE_FOLDERS[folder] && folder !== sub.slug ? folder : null;
      const href = `/shop/${category.slug}?sub=${encodeURIComponent(sub.slug)}${
        group ? `&group=${encodeURIComponent(group)}` : ""
      }`;
      rows.push({
        hub: category.slug,
        sub: sub.slug,
        group,
        label: SUBCATEGORY_LABELS[sub.slug],
        href,
        count: sub.count,
      });
    }
  }
  return rows;
}

export function readBakedTaxonomy(): BakedTaxonomy {
  const nav = JSON.parse(readFileSync(navPath, "utf8")) as { taxonomy: BakedTaxonomy };
  return nav.taxonomy;
}

export function storefrontSubLinks(): StorefrontSubLink[] {
  return storefrontSubLinksFromTaxonomy(readBakedTaxonomy());
}

export function renderStorefrontSubLinks(rows: readonly StorefrontSubLink[]) {
  return `${JSON.stringify(rows, null, 2)}\n`;
}

export function subLinkHubCounts(rows: readonly StorefrontSubLink[]) {
  const counts = new Map<string, number>();
  for (const row of rows) counts.set(row.hub, (counts.get(row.hub) ?? 0) + 1);
  return counts;
}

function isDirectRun() {
  const entry = process.argv[1];
  if (!entry) return false;
  return import.meta.url === pathToFileURL(entry).href;
}

function main() {
  const rows = storefrontSubLinks();
  const rendered = renderStorefrontSubLinks(rows);
  const check = process.argv.includes("--check");
  if (check) {
    let committed = "";
    try {
      committed = readFileSync(outPath, "utf8");
    } catch {
      console.error("data/storefront-sub-links.json is missing. Run npm run gen:sub-links.");
      process.exit(1);
    }
    if (committed !== rendered) {
      console.error("data/storefront-sub-links.json is stale. Run npm run gen:sub-links.");
      process.exit(1);
    }
  } else {
    writeFileSync(outPath, rendered);
  }
  const counts = subLinkHubCounts(rows);
  console.log(`${rows.length} sub links across ${counts.size} hubs`);
  for (const [hub, count] of counts) console.log(`${hub} ${count}`);
}

if (isDirectRun()) main();
