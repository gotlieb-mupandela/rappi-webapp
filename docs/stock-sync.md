# Daily stock sync into Supabase

The storefront listing merges `storefront_overlay()` (Supabase `products` and `product_sizes`) over the baked catalog in `data/products.json`. The morning Joma sync updates the repo files only. This job copies stock from those files into the database and busts the catalog cache (`unstable_cache`, tag `catalog`, revalidate 3600) so the site does not keep the previous overlay for an hour.

`data/products.json` is the source that gets written:

| Repo field | Database column |
| --- | --- |
| `sizes[].size` / `sizes[].stock` | `product_sizes.stock` (upsert) |
| sizes present only in the database | `product_sizes.stock = 0` (row kept) |
| `stockQty` | `products.stock_qty` |
| `available` | `products.available` |

`available: false` is copied as-is. In-stock pack-policy SKUs stay hidden. Availability is not recomputed from `stockQty`.

Rows that already match are skipped. Writes go out in batches of 400 through `apply_repo_stock_batch`, which sets only `product_sizes.stock`, `products.stock_qty`, and `products.available`. It does not write price, `unit_price`, `pack_size`, names, images, or `content_changed_at`. Products that exist only in the repo are counted and left uninserted. Products that exist only in the database are left untouched.

A trigger on `product_sizes` sets `stock_qty` to the sum of sizes. The job still writes `stock_qty` when that sum is not the repo `stockQty`.

## What runs when

1. **File sync (unchanged).** `npm run sync:joma -- --write` still writes `data/size-master.json` and, with `--write-catalog`, `data/products.json`. After those files are written it runs the database sync below. If Supabase is down, the failure is printed and the script still exits 0 so the morning commit can proceed. `SKIP_STOCK_DB_SYNC=1` skips the database step.
2. **Database sync.** `npm run sync:stock-db` reads the baked catalog and the database, writes the differing stock, then calls the revalidate route when the secret and base URL are set. This command exits non-zero on failure. Re-running it is safe.
3. **After the commit reaches `main`.** `.github/workflows/sync-stock-db.yml` runs when `data/products.json` or `data/size-master.json` changes. It is a second pass. If step 2 already converged, this pass writes nothing and only refreshes the cache. A red run does not revert the file commit.

The morning routine should keep committing the JSON files even when the database step fails. Put the database command where a failure cannot roll the commit back:

```bash
npm run sync:stock-db || echo "STOCK DB SYNC FAILED — catalog files are still committed; re-run npm run sync:stock-db"
git add data/products.json data/size-master.json
git commit -m "chore: daily Joma B2B stock sync $(date +%F)"
git push
```

If the routine already runs `npm run sync:joma -- --write`, that script calls the database sync itself. The snippet above is the explicit step when the routine writes the JSON files another way.

## Apply the migration once

Before the first successful run, apply `supabase/migrations/20261011181000_apply_repo_stock_batch.sql` to the Supabase project **RappiSport** (SQL editor or your usual migration path). The function is executable only by the service role. Until it exists, the sync fails with an error that names this file and writes nothing.

## Environment

Generate one long random string for `CATALOG_REVALIDATE_SECRET` and use that same value everywhere it appears.

### Vercel (the live site)

| Variable | Required | Purpose |
| --- | --- | --- |
| `CATALOG_REVALIDATE_SECRET` | Yes | `POST /api/catalog/revalidate` rejects calls without it. |
| `NEXT_PUBLIC_SUPABASE_URL` | Already set | Unchanged. |
| `SUPABASE_SERVICE_ROLE_KEY` | Already set | Unchanged. The route does not read it. |
| `NEXT_PUBLIC_SITE_URL` | Already set | Unchanged. |

Set the secret, then redeploy so the new route and the env var are both live. The route returns 503 until the secret is present and 401 for a wrong secret.

### Morning routine, and GitHub Actions secrets of the same names

| Variable | Required | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Project URL, same value as Vercel. |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Service role key. Same variable as `lib/supabase/admin.ts`. Never commit it and never prefix it with `NEXT_PUBLIC_`. |
| `CATALOG_REVALIDATE_SECRET` | Yes, to refresh the cache | Must match Vercel. If it or the base URL is missing, the database write still runs and the cache expires on its own within an hour. |
| `CATALOG_REVALIDATE_URL` | Yes, unless `NEXT_PUBLIC_SITE_URL` is set | Origin to call, `https://www.rappisportshub.com` (no path). |

GitHub repository secrets: `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `CATALOG_REVALIDATE_SECRET`, `CATALOG_REVALIDATE_URL`.

## Dry-run

Prints counts only. It reads the database and does not write or revalidate.

```bash
npm run sync:stock-db -- --dry-run
```

`differing` is the number of products whose stock or availability does not match. `sizeUpserts` and `sizeZeros` are size rows that would change. `stockQtyUpdates` and `availableUpdates` are product-column writes. `unmatchedRepo` counts baked SKUs that are not in the database. `dbOnlyUntouched` counts database products left as they are.

## Roll back

The sync does not delete size rows and does not change prices, names, images, or `content_changed_at`.

To undo a bad stock push, restore the previous catalog file and run the sync again. That writes the previous quantities back, including sizes the bad run had set to 0:

```bash
git checkout <good-commit> -- data/products.json
npm run sync:stock-db
```

A size that existed only in the database stays at 0, because the job never deletes it and the repo file has no quantity to restore. To return the database to an exact earlier moment, use a Supabase point-in-time backup from before the run.

After a roll-back write, the sync calls the revalidate route when the secret and base URL are set. Otherwise:

```bash
curl -X POST -H "Authorization: Bearer $CATALOG_REVALIDATE_SECRET" \
  https://www.rappisportshub.com/api/catalog/revalidate
```

The catalog tag expires immediately (`revalidateTag('catalog', { expire: 0 })`). The same call also revalidates `/api/catalog`, `/api/search`, `/api/mobile/storefront`, `/api/catalog/nav`, `/api/catalog/folders`, `/api/feeds/meta-catalog`, and `/api/products/[...code]`, so those cached responses refresh on the next request instead of waiting out their edge TTL. The next listing request loads a fresh overlay.
