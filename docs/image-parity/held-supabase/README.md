# Held: Supabase products.images (not touched)

Nothing in this folder is applied. No Supabase read or write was done for this PR.

Why it is held: storefront galleries come from the baked data/products.json (lib/offline-catalog.ts line 12, app/product/[...code]/page.tsx lines 8 and 26). Supabase full rows, including images (lib/catalog-map.ts lines 75 and 76), are used only for products edited in admin after the bake or missing from it (lib/supabase/catalog.ts lines 49 to 66 and 128 to 140) and for fresh checkout lookups (lines 236 to 252).

If Gotlieb approves the same change in Supabase:
1. Read only, first: export code, image_url, images for the codes in ../dry-run.csv as a backup.
2. Target values are the new_images column of ../dry-run.csv (image_url = first URL; empty for GOLCW2602FGD and GOLS2601AG).
3. Apply only with Gotlieb's OK via David. This is a production write.
