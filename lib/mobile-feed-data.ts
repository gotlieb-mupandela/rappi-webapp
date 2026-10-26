import "server-only";

import { unstable_cache } from "next/cache";
import { CATALOG_CACHE_TAG } from "@/lib/catalog-cache-tag";
import { catalogVersion } from "@/lib/catalog-version";
import { memoizedMobileStorefront } from "@/lib/mobile-feed";
import { FEED_TREE_REVISION, mobileFeedVersion } from "@/lib/mobile-feed-version";
import { getCatalogLive } from "@/lib/supabase/catalog";

/**
 * Catalogue snapshot already tagged `catalog`. Admin saves call revalidateCatalog,
 * which drops that tag, so the next read rebuilds this feed from the new snapshot.
 * The feed body is not stored in the data cache: a full card list can pass the
 * 2 MB cache entry limit. The version string is small and uses the same tag.
 */
export const getMobileCatalogueVersion = unstable_cache(
  async () => mobileFeedVersion(catalogVersion(await getCatalogLive())),
  ["mobile-v1-version", String(FEED_TREE_REVISION)],
  { revalidate: 60, tags: [CATALOG_CACHE_TAG] },
);

export async function readMobileStorefront() {
  const catalog = await getCatalogLive();
  return memoizedMobileStorefront(catalog, catalogVersion(catalog));
}
