/** Data-cache tag for the live catalogue snapshot. Not taken from a request. */
export const CATALOG_CACHE_TAG = "catalog";

/**
 * Route handlers whose cached GET responses include catalogue data.
 * Every entry is a literal path. Do not append request input to this list.
 */
export const CATALOG_REVALIDATE_PATHS = [
  "/api/catalog",
  "/api/search",
  "/api/mobile/storefront",
  "/api/catalog/nav",
  "/api/catalog/folders",
  "/api/feeds/meta-catalog",
] as const;

/** Dynamic route handlers. `type` is required by revalidatePath when the path has a segment. */
export const CATALOG_REVALIDATE_DYNAMIC_PATHS = [
  { path: "/api/products/[...code]", type: "page" },
] as const;
