import { revalidatePath, revalidateTag } from "next/cache";
import {
  CATALOG_CACHE_TAG,
  CATALOG_REVALIDATE_DYNAMIC_PATHS,
  CATALOG_REVALIDATE_PATHS,
} from "@/lib/catalog-revalidate-paths";
import { clearLiveCatalogMemo } from "@/lib/supabase/catalog";

/** Drop the live catalogue cache and the cached listing routes. No arguments. */
export function revalidateCatalog() {
  revalidateTag(CATALOG_CACHE_TAG, { expire: 0 });
  for (const path of CATALOG_REVALIDATE_PATHS) {
    revalidatePath(path);
  }
  for (const entry of CATALOG_REVALIDATE_DYNAMIC_PATHS) {
    revalidatePath(entry.path, entry.type);
  }
  clearLiveCatalogMemo();
}
