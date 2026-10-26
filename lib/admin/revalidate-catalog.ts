import "server-only";

import { revalidateTag } from "next/cache";
import { CATALOG_CACHE_TAG } from "@/lib/catalog-cache-tag";
import { clearLiveCatalogMemo } from "@/lib/supabase/catalog";

/**
 * Drop the live catalogue snapshot tagged `catalog`.
 * No path argument. Does not purge the site, layouts, or other tags.
 */
export function revalidateCatalog() {
  revalidateTag(CATALOG_CACHE_TAG, { expire: 0 });
  clearLiveCatalogMemo();
}
