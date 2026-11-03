"use server";

import { revalidateCatalog } from "@/lib/admin/revalidate-catalog";
import { createClient } from "@/lib/supabase/server";
import { safeProductCode } from "@/lib/utils";

export type ProductSaveInput = {
  id?: string;
  code: string;
  item: string;
  title: string;
  name: string;
  displayName: string;
  categorySlug: string;
  subcategory: string;
  gender: "men" | "women" | "kids" | "unisex";
  price: number;
  unitPrice: number;
  badge: "" | "new" | "offer";
  imageUrl: string;
  images: string[];
  description?: string;
  available?: boolean;
  sellAs?: "" | "pack" | "assortment" | "multipack";
  packSize?: number | null;
  sizes: Array<{ size: string; stock: number }>;
};

export async function saveProductAction(input: ProductSaveInput) {
  const supabase = await createClient();
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) return { error: "Not authorized." };

  const productId = (input.id || safeProductCode(input.code)).trim();
  const payload = {
    id: productId,
    code: input.code.trim(),
    item: input.item.trim(),
    title: input.title.trim() || `${input.item.trim()} · ${input.code.trim()}`,
    name: input.name.trim() || `${input.item.trim()} · ${input.code.trim()}`,
    display_name: input.displayName.trim() || input.item.trim(),
    category_slug: input.categorySlug,
    subcategory: input.subcategory.trim() || "general",
    gender: input.gender,
    price: Number(input.price),
    unit_price: Number(input.unitPrice || input.price),
    currency: "NAD",
    badge: input.badge || null,
    image_url: input.imageUrl || "/brand/rappi-logo-v2.png",
    images: input.images.length ? input.images : input.imageUrl ? [input.imageUrl] : [],
    description: input.description?.trim() ?? "",
    available: input.available !== false,
    sell_as: input.sellAs || null,
    pack_size: input.packSize ?? null,
  };

  const { error } = await supabase.from("products").upsert(payload);
  if (error) return { error: error.message };

  const { error: sizeError } = await supabase.rpc("replace_product_sizes", {
    p_product_id: productId,
    p_sizes: input.sizes
      .filter((s) => s.size.trim())
      .map((s) => ({
        size: s.size.trim(),
        stock: Math.max(0, Number(s.stock) || 0),
      })),
  });
  if (sizeError) return { error: sizeError.message };

  revalidateCatalog();
  return { ok: true as const, id: productId };
}

export async function deleteProductAction(id: string) {
  const supabase = await createClient();
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) return { error: "Not authorized." };
  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidateCatalog();
  return { ok: true as const };
}
