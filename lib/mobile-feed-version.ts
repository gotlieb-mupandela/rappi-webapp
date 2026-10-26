/** Query `v` is a cache key only. Callers must not copy the value into a body or header. */
export const FEED_VERSION_PARAM = /^[A-Za-z0-9._-]{1,64}$/;

/**
 * Bumped when the navigation tree shape changes.
 * The catalogue hash stays the prefix so a product change still moves the version.
 */
export const FEED_TREE_REVISION = 6;

export function mobileFeedVersion(catalogVersion: string): string {
  const suffix = `.${FEED_TREE_REVISION}`;
  return catalogVersion.endsWith(suffix) ? catalogVersion : `${catalogVersion}${suffix}`;
}

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
