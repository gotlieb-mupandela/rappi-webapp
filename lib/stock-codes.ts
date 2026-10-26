/** Codes kept on GET /api/stock after trim and de-duplication. */
export const STOCK_CODE_LIMIT = 50;

/**
 * Longest product code sent to the catalog lookup.
 * A longer code is invalid. When it still fits in STOCK_CODE_LIMIT it is
 * returned as unavailable. Past that limit it is omitted.
 */
export const STOCK_CODE_MAX_LENGTH = 65;

/** Must match the mobile app's PRODUCT_CODE. */
export const PRODUCT_CODE = /^(?!.*\.\.)(?!.*\/\/)(?!.*\/\.)[A-Za-z0-9](?:[A-Za-z0-9._,\/-]{0,63}[A-Za-z0-9._-])?$/;

export type ParsedStockCodes = {
  /** Response keys, first-seen order, at most STOCK_CODE_LIMIT. */
  codes: string[];
  /** Members of `codes` longer than STOCK_CODE_MAX_LENGTH. */
  overLength: string[];
  /**
   * Members of `codes` that must not be looked up.
   * The route returns each one as unavailable under its exact key.
   */
  rejected: string[];
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
 * combined list is then cut at STOCK_CODE_LIMIT. Each kept code is checked
 * against PRODUCT_CODE. A code longer than 65 characters fails that check
 * as well. Failures stay in `codes` and `rejected`, and are left out of
 * the lookup list.
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
  const rejected: string[] = [];

  for (const value of merged) {
    const code = value.trim();
    if (!code || seen.has(code)) continue;
    seen.add(code);
    codes.push(code);
    const tooLong = code.length > STOCK_CODE_MAX_LENGTH;
    if (tooLong) overLength.push(code);
    if (tooLong || !PRODUCT_CODE.test(code)) rejected.push(code);
    if (codes.length === STOCK_CODE_LIMIT) break;
  }

  return { codes, overLength, rejected };
}

/** Codes safe to pass to getFreshCheckoutProducts. */
export function lookupStockCodes(parsed: ParsedStockCodes): string[] {
  if (!parsed.rejected.length) return parsed.codes;
  const blocked = new Set(parsed.rejected);
  return parsed.codes.filter((code) => !blocked.has(code));
}
