"use server";

import { revalidateCatalog } from "@/lib/admin/revalidate-catalog";
import { createClient } from "@/lib/supabase/server";

/**
 * Refresh the catalogue caches after an admin write.
 * Takes no path or tag argument. Refuses callers who are not admins.
 */
export async function revalidateCatalogAfterWrite(): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) return { ok: false };
  revalidateCatalog();
  return { ok: true };
}
