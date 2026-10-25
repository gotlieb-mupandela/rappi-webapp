/**
 * Characters that can change a PostgREST `or` filter or an ilike pattern.
 * Comma and parentheses add or close clauses. Backslash and quotes change
 * parsing. Percent is an ilike wildcard, and PostgREST treats `*` as `%`.
 */
const POSTGREST_FILTER_META = /[,()%\\*"]/g;

export function sanitizeAdminSearchTerm(raw: string): string {
  return raw.replace(POSTGREST_FILTER_META, "").trim();
}

const PRODUCT_SEARCH_COLUMNS = ["code", "item", "name"] as const;

/** PostgREST `.or()` value for the admin product list. Null means "no text filter". */
export function adminProductSearchFilter(raw: string): string | null {
  const term = sanitizeAdminSearchTerm(raw);
  if (!term) return null;
  return PRODUCT_SEARCH_COLUMNS.map((column) => `${column}.ilike.%${term}%`).join(",");
}
