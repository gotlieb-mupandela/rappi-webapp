import orderData from "@/data/folder-collection-order.json";
import meta from "@/data/joma-folder-meta.json";
import portalOrderData from "@/data/joma-portal-order.json";

/** joma-sport.net display order per folder (portal codes mapped to our SKUs). */
const portalOrder = portalOrderData as Record<string, string[]>;

type MetaRow = {
  key: string;
  parent: string | null;
  hasChildren: boolean;
};

/** Ordered product codes filed directly on a folder (leaves, plus a few parents). */
const direct = orderData as Record<string, string[]>;

const parentOf = new Map<string, string | null>();
const childrenOf = new Map<string, string[]>();
for (const row of meta as MetaRow[]) {
  if (!parentOf.has(row.key)) parentOf.set(row.key, row.parent);
  if (!row.parent) continue;
  const list = childrenOf.get(row.parent);
  if (!list) childrenOf.set(row.parent, [row.key]);
  else if (!list.includes(row.key)) list.push(row.key);
}

const orderMemo = new Map<string, string[]>();
const visiting = new Set<string>();

/**
 * Supplier order for a folder. Parents concatenate their children in tree
 * order (first occurrence wins), then any codes filed on the parent itself.
 */
export function orderedCodes(key: string): readonly string[] {
  const cached = orderMemo.get(key);
  if (cached) return cached;
  if (visiting.has(key)) return direct[key] ?? [];
  visiting.add(key);
  const kids = childrenOf.get(key) ?? [];
  const own = direct[key] ?? [];
  if (!kids.length) {
    orderMemo.set(key, own);
    visiting.delete(key);
    return own;
  }
  const out: string[] = [];
  const seen = new Set<string>();
  for (const code of portalOrder[key] ?? []) {
    if (seen.has(code)) continue;
    seen.add(code);
    out.push(code);
  }
  for (const child of kids) {
    for (const code of orderedCodes(child)) {
      if (seen.has(code)) continue;
      seen.add(code);
      out.push(code);
    }
  }
  for (const code of own) {
    if (seen.has(code)) continue;
    seen.add(code);
    out.push(code);
  }
  orderMemo.set(key, out);
  visiting.delete(key);
  return out;
}

const position = new Map<string, Map<string, number>>();

function positions(key: string) {
  let map = position.get(key);
  if (map) return map;
  map = new Map();
  orderedCodes(key).forEach((code, index) => {
    map!.set(code, index);
  });
  position.set(key, map);
  return map;
}

/** Index of `code` in this folder's supplier order. Unknown codes sort last. */
export function positionInFolder(key: string, code: string) {
  return positions(key).get(code) ?? Number.MAX_SAFE_INTEGER;
}

export function sortByFolderOrder<T extends { code: string }>(key: string, products: T[]): T[] {
  return products
    .map((product, index) => ({
      product,
      index,
      pos: positionInFolder(key, product.code),
    }))
    .sort((a, b) => a.pos - b.pos || a.index - b.index)
    .map((row) => row.product);
}

const keysByCode = new Map<string, string[]>();
for (const [key, codes] of Object.entries(direct)) {
  const chain: string[] = [];
  let cur: string | null | undefined = key;
  const guard = new Set<string>();
  while (cur && !guard.has(cur)) {
    guard.add(cur);
    chain.push(cur);
    cur = parentOf.get(cur) ?? null;
  }
  for (const code of codes) {
    const prev = keysByCode.get(code);
    if (!prev) {
      keysByCode.set(code, [...chain]);
      continue;
    }
    for (const item of chain) {
      if (!prev.includes(item)) prev.push(item);
    }
  }
}

/** Folder keys for a product code, from the collection lists. No keyword rules. */
export function folderKeysForCode(code: string): string[] {
  return keysByCode.get(code) ?? [];
}
