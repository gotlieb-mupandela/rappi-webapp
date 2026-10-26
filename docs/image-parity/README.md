# Image parity with the public store (fix/image-parity-1)

Draft. Nothing merged or deployed. Only data/products.json image fields (imageUrl, images) change. Supabase is not touched.

## What changed
For every product on the public store (7,405 codes in data/store-image-indexes.json), images is now exactly the store photo list in ascending index order, and imageUrl is the first one. Store URL format is the same as demandwareUrl(code, n) in scripts/enrich-demandware-images.mjs.

- Products changed: 7,092 of 11,104. Not changed: 4,012.
- Reason tags (a product can have more than one): B2B_DROPPED 7,001 (all v1.joma-sport.net links dropped from on-store products, of which 37 were dead 404s), OTHER_EXTRA_DROPPED 1,403 (non-store or other-colour photos, includes the 9 MORE), ADDED_STORE_PHOTOS 480, RELATIVE_TO_STORE 70, RELATIVE_PREFIXED 3, LOGO_ONLY 3, LOGO_ONLY_CLEARED 2, REORDERED_ONLY 19.
- QA classes, all covered: dead B2B 37 of 37, logo-only 5 of 5, fewer 482 of 482, more 9 of 9, relative 75 of 75.
- Store photo order changed on 747 products. Only 19 changed nothing but order (reordered-only.csv).
- Not on the store: 1,152 codes (not-on-store.csv) keep their photos. Only 3 of them changed: relative /catalog-photos/ URLs prefixed with https://www.rappisportshub.com (GET 200 image/jpeg each).
- The 5 network-error codes from QA (902686.201, AGUW2621AG, 102223.901, WINTER11-111, 400194.100) were re-probed with GET and their store indexes added.

## Open points (defaults chosen, David to confirm)
- A: store order wins over "person photo first".
- B: photos not on the store are dropped, not kept last.

## Logo-only
RMETAW2631, RMETLW2620, 104937.273 now use their store photos. GOLCW2602FGD and GOLS2601AG are 404 on the store, so the logo is removed and the gallery is empty. Effect Gotlieb will see: both now show the no-photo plate and drop out of browse grids (lib/listing-core.ts productHasImage, because hasUsableProductImage is false). Their product pages still work.

## Files
- dry-run.csv: code, old images, new images, reason.
- backup-old-images.json: old imageUrl and images for every changed product.
- reordered-only.csv: the 19 order-only changes.
- not-on-store.csv: the 1,152 codes left alone.
- check-output.txt: output of npm run check:store-images.
- held-supabase/: why Supabase is not changed, and the steps if approved.

## Undo the v1 drop on its own
The drop of v1.joma-sport.net photos from the 7,001 on-store products is inside the first commit of this PR. The follow-up commit adds docs/image-parity/v1-drop-revert.csv (code, dropped_url, kept_url; kept_url is the product's first store photo, which now leads the gallery) and a restore mode:
- Dry run: node scripts/sync-store-images.mjs --restore-v1
- Apply: node scripts/sync-store-images.mjs --restore-v1 --write
It re-adds exactly the listed URLs after the store photos (not in their old position) and skips any already present. Tested: 7,001 products restored, then reverted.

## Re-run
- Dry run (reports only): node scripts/sync-store-images.mjs
- Apply: node scripts/sync-store-images.mjs --write
- Revert the order-only part: restore data/products.json from main, then run with --write --keep-our-order (products whose only change is order are left as they were). Or restore any product from backup-old-images.json.
- Check: npm run check:store-images (plain node).

## Not verified
- No pixel or hash comparison against the store photos. QA will run it.
- Store order is index order (_1, _2, ...). The order on store pages was not read.
- Dropped v1 B2B photos are assumed to be a different shoot of the same product; not compared.
- The 3 prefixed URLs were checked for HTTP 200 and image type only, not for showing the right product.

## RVICTW2612 and TKTULW2625 (QA tagged them fewer)
Not missing a photo. Store indexes _1 to _5 return 200 and _6 to _10 return 404 (GET, 2026-10-26). The baked gallery on main already had _1 to _5 plus one v1 photo; this PR leaves _1 to _5. Supabase holds only 1 photo (the v1 one) for each, which matches the 1 photo QA counted. No data fix needed in products.json.

## Supabase
See held-supabase/README.md: read-only backup and sizing, and the held one-transaction script. Nothing was written.

## Two baked-only products added after QA's report
401346.331 and 700133.100 were not in QA's parity CSV, so the first pass left a v1 photo first. Their store photos were probed with GET on 2026-10-26 (401346.331: _1 to _3; 700133.100: _1 to _5) and added by hand: the v1 photo is dropped, the store photos were already there. This brings the totals to 7,405 on-store products and 7,003 v1 drops (v1-drop-revert.csv, dry-run.csv and backup-old-images.json have the 2 extra rows). Note: 700133.100 is marked available:false in the baked data. The other 2,547 baked-only products (mostly hidden, available:false) stay out of scope.
