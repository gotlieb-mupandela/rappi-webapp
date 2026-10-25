-- NOT APPLIED. Do not run this until the forward migration has been approved,
-- applied, and then needs to be undone. This file is not in supabase/migrations,
-- so migrate will not pick it up.
--
-- Drops product_images_admin_select and recreates product_images_public_read
-- (SELECT, public), matching the live policy this forward file would drop.
-- It does not recreate avatars_public_read. That policy does not exist live,
-- and the forward file does not drop any avatars SELECT policy.
-- Owner policies on both buckets are left in place.
-- This rollback does not restore earlier file size or MIME limits.
-- product-images would keep the 5 MB jpeg/png/webp/avif limit.
-- avatars stays at its live limit (5 MB, jpeg/png/webp).

drop policy if exists product_images_admin_select on storage.objects;

drop policy if exists product_images_public_read on storage.objects;
create policy product_images_public_read
  on storage.objects for select
  using (bucket_id = 'product-images');
