/**
 * Public slug renames. The mobile app still requests the old slugs and
 * caches catalog JSON for 7 days, so API routes accept both and answer
 * with the new slug.
 *
 * This is a fixed lookup. Unknown strings are left unchanged for normal
 * catalog handling. Do not copy an unknown slug into a redirect target.
 */
export const SLUG_ALIASES: Readonly<Record<string, string>> = {
  "joma-flow": "flow",
  "joma-kids": "kids",
};

/** Folder and subcategory label for the public flow slug. Tab label is KIDS. */
export const CANONICAL_SLUG_LABELS: Readonly<Record<string, string>> = {
  flow: "Flow",
  kids: "KIDS",
};

export function canonicalSlug(slug: string): string {
  return SLUG_ALIASES[slug] ?? slug;
}

/** Trim a query value and map a legacy slug onto the public one. */
export function canonicalQuerySlug(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return undefined;
  return canonicalSlug(trimmed);
}

export function canonicalSlugLabel(slug: string, fallback?: string): string {
  const key = canonicalSlug(slug);
  return CANONICAL_SLUG_LABELS[key] ?? fallback ?? key;
}
