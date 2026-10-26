/** Codes kept on GET /api/stock after trim and de-duplication. */
export const STOCK_CODE_LIMIT = 50;

/**
 * Longest product code sent to the catalog lookup.
 * A longer code is not queried. When it still fits in STOCK_CODE_LIMIT it is
 * returned as unavailable. Past that limit it is omitted.
 */
export const STOCK_CODE_MAX_LENGTH = 65;

export type ParsedStockCodes = {
  /** Response keys, first-seen order, at most STOCK_CODE_LIMIT. */
  codes: string[];
  /** Members of `codes` that must not be looked up. */
  overLength: string[];
};

/**
 * Read product codes for GET /api/stock.
 *
 * `code` may be repeated. Each value is one code and is never split.
 * `codes` is the legacy comma-joined list: only the first value is read,
 * then split on comma. A comma inside a legacy value is a separator, so a
 * code such as 946,001 cannot travel in `codes`. Repeated `codes` values
 * are not separate codes.
 *
 * Repeated `code` values come first, then the legacy split. Values are
 * trimmed, empties dropped, and duplicates removed (first one wins). The
 * combined list is then cut at STOCK_CODE_LIMIT.
 */
export function parseStockCodes(params: URLSearchParams): ParsedStockCodes {
  const merged: string[] = [];

  for (const value of params.getAll("code")) {
    merged.push(value);
  }

  const legacy = params.get("codes");
  if (legacy) {
    for (const value of legacy.split(",")) {
      merged.push(value);
    }
  }

  const seen = new Set<string>();
  const codes: string[] = [];
  const overLength: string[] = [];

  for (const value of merged) {
    const code = value.trim();
    if (!code || seen.has(code)) continue;
    seen.add(code);
    codes.push(code);
    if (code.length > STOCK_CODE_MAX_LENGTH) overLength.push(code);
    if (codes.length === STOCK_CODE_LIMIT) break;
  }

  return { codes, overLength };
}

/** Codes safe to pass to getFreshCheckoutProducts. */
export function lookupStockCodes(parsed: ParsedStockCodes): string[] {
  if (!parsed.overLength.length) return parsed.codes;
  const blocked = new Set(parsed.overLength);
  return parsed.codes.filter((code) => !blocked.has(code));
}
