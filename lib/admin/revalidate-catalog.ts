import { revalidateTag } from "next/cache";
import { clearLiveCatalogMemo } from "@/lib/supabase/catalog";

export function revalidateCatalog() {
  revalidateTag("catalog", { expire: 0 });
  clearLiveCatalogMemo();
}
