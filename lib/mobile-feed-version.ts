/** Query `v` is a cache key only. Callers must not copy the value into a body or header. */
export const FEED_VERSION_PARAM = /^[A-Za-z0-9._-]{1,64}$/;

/**
 * Missing `v` is valid: the handler returns the current feed.
 * A present value that fails the pattern is invalid, including an empty string
 * and more than one `v`. The raw text is not returned.
 */
export function feedVersionParamStatus(values: readonly string[]): "ok" | "invalid" {
  if (values.length === 0) return "ok";
  if (values.length === 1 && FEED_VERSION_PARAM.test(values[0])) return "ok";
  return "invalid";
}
