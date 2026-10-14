import live from "@/data/joma-live-folders.json";

/** Browse folders holding at least one live product (baked by scripts/bake-catalog.ts). */
const LIVE = new Set(live as string[]);

/** False only for folders the bake saw with no live product. Unknown keys stay visible. */
export function isLiveFolder(key: string, knownFolder = true) {
  if (!LIVE.size || !knownFolder) return true;
  return LIVE.has(key);
}
