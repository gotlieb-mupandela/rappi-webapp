-- HELD. Do not run this until the forward file has been approved, applied,
-- and then needs to be undone. This file is not in supabase/migrations, so
-- supabase db push and the Supabase GitHub integration will not run it.
-- See supabase/held-migrations/README.md.
--
-- Reverses the product-images statements in
-- supabase/held-migrations/20261025221801_product_image_limits_and_avatars.sql.
-- Drops product_images_admin_select, recreates product_images_public_read
-- (SELECT, public), and restores product-images to the live limits: public,
-- file_size_limit null, allowed_mime_types null.
--
-- It does not recreate avatars_public_read. That policy does not exist live,
-- and the forward file does not drop any avatars SELECT policy.
-- The forward avatars update writes the limits that already exist live
-- (public, 5 MB, jpeg/png/webp), so this rollback does not change avatars.

drop policy if exists product_images_admin_select on storage.objects;

drop policy if exists product_images_public_read on storage.objects;
create policy product_images_public_read
  on storage.objects for select
  using (bucket_id = 'product-images');

update storage.buckets
set
  public = true,
  file_size_limit = null,
  allowed_mime_types = null
where id = 'product-images';
