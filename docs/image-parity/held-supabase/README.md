# Held: Supabase products.images (not touched)

Nothing in this folder is applied. No Supabase read or write was done for this PR.

Why it is held: storefront galleries come from the baked data/products.json (lib/offline-catalog.ts line 12, app/product/[...code]/page.tsx lines 8 and 26). Supabase full rows, including images (lib/catalog-map.ts lines 75 and 76), are used only for products edited in admin after the bake or missing from it (lib/supabase/catalog.ts lines 49 to 66 and 128 to 140) and for fresh checkout lookups (lines 236 to 252).

If Gotlieb approves the same change in Supabase:
1. Read only, first: export code, image_url, images for the codes in ../dry-run.csv as a backup.
2. Target values are the new_images column of ../dry-run.csv (image_url = first URL; empty for GOLCW2602FGD and GOLS2601AG).
3. Apply only with Gotlieb's OK via David. This is a production write.

## Read-only backup and sizing (2026-10-26, UTC+2)
A read-only SELECT of id, code, image_url, images from public.products was saved on the box only (not in git): /workspace/image-parity-backup/supabase-products-images.json (11,105 rows). A box-only dry run (code, old value, new value) is /workspace/image-parity-backup/supabase-dry-run.csv.
- Supabase rows that differ from the baked main data/products.json: 3,541.
- Rows that differ from this PR's target: 7,482. The held script below only sets the on-store and logo-only rows, so it would update about 7,402 rows.
- Products with no Supabase row: 0. Supabase rows with no baked product: 1.

## apply-images.mjs (HELD, not run)
- Touches only public.products.images and public.products.image_url, matched by exact code.
- Default is a dry run that prints counts only. `--emit-sql` prints one transaction (BEGIN to COMMIT) that loads a temp table, validates every URL against the strict store pattern in the database, and updates only rows that differ.
- Every new URL must be https://www.joma-sport.com/on/demandware.static/-/Sites-joma-masterCatalog/default/images/medium/<code>_<n>.jpg with no spaces, quotes, ?, # or %. The script refuses to emit SQL if any fails. Empty galleries are allowed only for GOLCW2602FGD and GOLS2601AG.
- Skipped on purpose: 709/101, 711/101, TEAM/14 (a slash in the code does not fit the strict pattern), and the 3 not-on-store products with prefixed catalog photos. Their Supabase values stay as they are.
- It never connects to a database and never reads a key. The operator connects with psql using the DATABASE_URL env var, which is never stored in the repo and never logged. It is not wired to any route.

## How an operator would run it (only after Gotlieb's yes via David and Security's review)
1. Take a fresh read-only backup of code, image_url, images and note its path.
2. node docs/image-parity/held-supabase/apply-images.mjs (check the counts).
3. node docs/image-parity/held-supabase/apply-images.mjs --emit-sql > /tmp/apply-images.sql and have Security review it.
4. psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f /tmp/apply-images.sql (one transaction; any failed check rolls everything back).
5. Undo: restore from the backup with the same one-transaction pattern.
