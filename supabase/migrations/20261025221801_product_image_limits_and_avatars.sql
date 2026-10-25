-- NOT APPLIED. This file is not run by this change. Review and approve it
-- before anyone applies it to a database.
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
set public = true;

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
