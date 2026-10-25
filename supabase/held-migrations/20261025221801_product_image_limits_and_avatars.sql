-- HELD. Do not apply this file until Gotlieb OKs.
-- It lives in supabase/held-migrations, not supabase/migrations, so
-- supabase db push and the Supabase GitHub integration will not run it.
-- See supabase/held-migrations/README.md.
--
-- Rollback (also held, also not applied):
-- supabase/held-migrations/20261025221801_product_image_limits_and_avatars.rollback.sql
-- That file restores product_images_public_read, drops product_images_admin_select,
-- and sets product-images file_size_limit and allowed_mime_types back to null.
-- It does not touch avatars policies.
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

-- Down SQL, commented so this file does not run it. Same statements as
-- supabase/held-migrations/20261025221801_product_image_limits_and_avatars.rollback.sql.
-- Recreates only product_images_public_read. avatars_public_read never existed
-- live, so it is not created here. product-images limits go back to null.
-- The avatars update above matches live, so the rollback does not change avatars.
--
-- drop policy if exists product_images_admin_select on storage.objects;
--
-- drop policy if exists product_images_public_read on storage.objects;
-- create policy product_images_public_read
--   on storage.objects for select
--   using (bucket_id = 'product-images');
--
-- update storage.buckets
-- set
--   public = true,
--   file_size_limit = null,
--   allowed_mime_types = null
-- where id = 'product-images';
