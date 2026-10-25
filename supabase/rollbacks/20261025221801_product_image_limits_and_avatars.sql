-- NOT APPLIED. Do not run this until the forward migration has been approved,
-- applied, and then needs to be undone. This file is not in supabase/migrations,
-- so migrate will not pick it up.
--
-- Restores the anonymous list policies. Both buckets stay public, so a known
-- object URL still downloads.
--
-- product_images_public_read matches 20260907100003_admin_panel.sql.
-- avatars_public_read is that same policy for the avatars bucket (the SELECT
-- this forward migration drops). Owner-folder write policies are left in place.
-- This rollback does not restore earlier file size or MIME limits.
-- Those limits stay as the forward migration set them. There is no
-- previous limit to put back.

drop policy if exists product_images_admin_select on storage.objects;

drop policy if exists product_images_public_read on storage.objects;
create policy product_images_public_read
  on storage.objects for select
  using (bucket_id = 'product-images');

drop policy if exists avatars_public_read on storage.objects;
create policy avatars_public_read
  on storage.objects for select
  using (bucket_id = 'avatars');
