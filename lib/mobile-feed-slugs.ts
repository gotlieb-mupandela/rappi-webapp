/**
 * Public folder slugs for the mobile feed.
 * Two entries only. PR 93 (fix/rename-joma-labels-1) adds lib/slug-aliases.ts
 * with the same pair. This table is local so the feed does not depend on that branch.
 */
export const LEGACY_FOLDER_SLUGS = {
  "joma-kids": "kids",
  "joma-flow": "flow",
} as const;

export function publicFolderKey(key: string): string {
  let next = key;
  for (const [from, to] of Object.entries(LEGACY_FOLDER_SLUGS)) {
    if (next === from) return to;
    next = next.split(from).join(to);
  }
  return next;
}

/** Strip the brand word from a title, label, or name. Image URLs are not passed here. */
export function publicCopy(value: string): string {
  return value
    .replace(/joma/gi, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([·|/])/g, " $1")
    .trim();
}
