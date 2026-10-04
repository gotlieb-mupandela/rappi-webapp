import raw from "@/data/joma-folder-meta.json";

export type JomaFolderMeta = {
  key: string;
  label: string;
  parent: string | null;
  hasChildren: boolean;
  sub: string | null;
};

const rows = raw as JomaFolderMeta[];
const BY_KEY = new Map(rows.map((row) => [row.key, row]));
const CHILDREN = new Map<string, JomaFolderMeta[]>();
for (const row of rows) {
  if (!row.parent) continue;
  const list = CHILDREN.get(row.parent);
  if (list) list.push(row);
  else CHILDREN.set(row.parent, [row]);
}

export function jomaFolderByKey(key: string) {
  return BY_KEY.get(key);
}

export function isJomaBrowseFolder(key: string) {
  return BY_KEY.has(key);
}

export function jomaFolderHasChildren(key: string) {
  return Boolean(BY_KEY.get(key)?.hasChildren);
}

export function jomaFolderParentKey(key: string) {
  return BY_KEY.get(key)?.parent ?? undefined;
}

export function jomaFolderAncestorKeys(key: string): string[] {
  const chain: string[] = [];
  let cur = BY_KEY.get(key)?.parent ?? null;
  while (cur) {
    chain.unshift(cur);
    cur = BY_KEY.get(cur)?.parent ?? null;
  }
  return chain;
}

export function jomaFolderIsSharedAudience(key: string) {
  let cur: string | undefined = key;
  while (cur) {
    if (cur === "teamwear-pro-2026") return true;
    cur = BY_KEY.get(cur)?.parent ?? undefined;
  }
  return false;
}

export function isOutletFolderKey(key: string) {
  if (key === "outlet") return true;
  let cur = BY_KEY.get(key)?.parent ?? null;
  while (cur) {
    if (cur === "outlet") return true;
    cur = BY_KEY.get(cur)?.parent ?? null;
  }
  return false;
}

export function jomaFolderSiblings(key: string): JomaFolderMeta[] {
  const parent = BY_KEY.get(key)?.parent;
  if (!parent) return [];
  return CHILDREN.get(parent) ?? [];
}
