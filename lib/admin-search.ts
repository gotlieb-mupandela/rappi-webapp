/** Longest cleaned admin product search sent to the catalogue filter. */
const MAX_LENGTH = 80;

/**
 * Characters that split, quote, or widen a PostgREST `.or()` ilike value.
 * Control characters (Unicode category Cc) are included.
 */
const STRIPPED = /[,()%*\\"\p{Cc}]/gu;

/**
 * Clean admin-typed product search text before it is placed inside
 * `code.ilike`, `item.ilike`, and `name.ilike`.
 *
 * Deletes comma, parentheses, percent, asterisk, backslash, double quote,
 * and control characters. Collapses whitespace, trims, and caps the length
 * at 80 characters. A comma in a catalogue code is deleted with the rest,
 * so "946,001" becomes "946001". Slashes stay, so "TEAM/14" is unchanged.
 *
 * Returns "" when nothing searchable remains. Callers skip the filter then.
 */
export function sanitizeAdminProductSearch(input: string): string {
  const cleaned = input.replace(STRIPPED, "").replace(/\s+/g, " ").trim();
  return Array.from(cleaned).slice(0, MAX_LENGTH).join("");
}
