# Held migrations

This folder is HELD. Do not apply these files until Gotlieb OKs.

`supabase db push` and the Supabase GitHub integration only run SQL in `supabase/migrations/`. These files stay here so nothing applies them by accident.

## What is held

`20261025221801_product_image_limits_and_avatars.sql` would:

- set `product-images` to a 5 MB limit and jpeg, png, webp, and avif
- drop `product_images_public_read`, which closes anonymous listing of that bucket
- create `product_images_admin_select` for authenticated admins
- set `avatars` to the limits it already has live (public, 5 MB, jpeg/png/webp), which is a no-op on the current database

The bucket stays public, so a known object URL still downloads. The admin upload check in the app does not depend on this SQL.

`20261025221801_product_image_limits_and_avatars.rollback.sql` sits beside the forward file. It reverses the product-images statements: it drops `product_images_admin_select`, restores `product_images_public_read`, and sets `product-images` back to public with `file_size_limit` null and `allowed_mime_types` null. That is the live state: no file size limit and no MIME restrictions. It does not change avatars and does not recreate `avatars_public_read`.

## How to apply later

After Gotlieb OKs:

1. Move the forward file back into `supabase/migrations/` with a fresh timestamp prefix, newer than every file already in that folder. Do not reuse `20261025221801`.
2. Apply it through the normal migration path once it is in `supabase/migrations/`.
3. Leave the rollback file in this folder. Run it by hand only if the forward change was applied and must be undone.

Do not apply either file before that OK.
