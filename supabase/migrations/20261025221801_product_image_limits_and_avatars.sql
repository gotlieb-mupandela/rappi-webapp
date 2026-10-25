-- NOT APPLIED. This file is not run by this change. Nothing here is applied
-- to production until it is reviewed and approved.
--
-- Rollback (also not applied): supabase/rollbacks/20261025221801_product_image_limits_and_avatars.sql
-- That file is not in supabase/migrations, so a migrate will not run it.
-- It only drops product_images_admin_select and recreates
-- product_images_public_read. It does not touch avatars policies.
--
-- Live product-images is public, with no size limit and no MIME limit.
-- Live policies: product_images_admin_delete, product_images_admin_insert,
-- product_images_admin_update, and product_images_public_read (SELECT, public).
-- There is no product_images_admin_select. This file adds the 5 MB limit and
-- jpeg/png/webp/avif, creates the admin SELECT, and drops the public SELECT.
-- The bucket stays public, so a known object URL still downloads.
--
-- Live avatars already exists: public, 5 MB, jpeg/png/webp, no avif.
-- Live policies are owner-folder only: avatars_own_read (SELECT, authenticated),
-- avatars_own_insert, avatars_own_update, avatars_own_delete.
-- There is no anonymous SELECT and no avatars_public_read.
-- This file does not drop or add any avatars SELECT policy, and it does not
-- recreate the owner policies. avif is not added, because live does not allow
-- it. The update sets the same limits, so on live it is a no-op.

update storage.buckets
set
  file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
where id = 'product-images';

drop policy if exists product_images_public_read on storage.objects;

drop policy if exists product_images_admin_select on storage.objects;
create policy product_images_admin_select
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'product-images'
    and (select public.is_admin())
  );

update storage.buckets
set
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
where id = 'avatars';

-- Down SQL, commented so this migration does not run it. Same statements as
-- supabase/rollbacks/20261025221801_product_image_limits_and_avatars.sql.
-- Recreates only product_images_public_read. avatars_public_read never existed
-- live, so it is not created here. Size and MIME limits are left in place.
--
-- drop policy if exists product_images_admin_select on storage.objects;
--
-- drop policy if exists product_images_public_read on storage.objects;
-- create policy product_images_public_read
--   on storage.objects for select
--   using (bucket_id = 'product-images');
