-- NOT APPLIED. This file is not run by this change. Nothing here is applied
-- to production until it is reviewed and approved.
--
-- Rollback (also not applied): supabase/rollbacks/20261025221801_product_image_limits_and_avatars.sql
-- That file is not in supabase/migrations, so a migrate will not run it.
-- It restores the anonymous SELECT policies below and leaves both buckets
-- public, so a known object URL still downloads.
--
-- product-images stays a public bucket, so a known object URL still downloads.
-- The broad SELECT policy is what lets an anonymous client list SKU paths.
-- Drop that policy. Admins keep SELECT so replace-upload (upsert) still works.
--
-- avatars is public for the same known-path read. There is no anonymous
-- SELECT policy, so anonymous listing is denied. Writes stay in the owner's
-- folder. The owner SELECT is what account deletion uses to list that folder.

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

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
on conflict (id) do update
set
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/avif'];

drop policy if exists avatars_public_read on storage.objects;
drop policy if exists avatars_owner_select on storage.objects;
create policy avatars_owner_select
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

drop policy if exists avatars_owner_insert on storage.objects;
create policy avatars_owner_insert
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

drop policy if exists avatars_owner_update on storage.objects;
create policy avatars_owner_update
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

drop policy if exists avatars_owner_delete on storage.objects;
create policy avatars_owner_delete
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

-- Down SQL, commented so this migration does not run it. Same statements as
-- supabase/rollbacks/20261025221801_product_image_limits_and_avatars.sql.
-- product_images_public_read is the policy from 20260907100003_admin_panel.sql.
-- avatars_public_read is that same anonymous SELECT for the avatars bucket,
-- which this migration drops. Buckets stay public, so known object URLs
-- still download after the rollback. The rollback does not restore earlier
-- size or MIME limits. Those limits stay.
--
-- drop policy if exists product_images_admin_select on storage.objects;
--
-- drop policy if exists product_images_public_read on storage.objects;
-- create policy product_images_public_read
--   on storage.objects for select
--   using (bucket_id = 'product-images');
--
-- drop policy if exists avatars_public_read on storage.objects;
-- create policy avatars_public_read
--   on storage.objects for select
--   using (bucket_id = 'avatars');
