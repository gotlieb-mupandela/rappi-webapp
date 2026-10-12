-- Align live stock with the baked catalog without touching merchandising.
--
-- Called by scripts/sync-stock-db.mjs (service role only). Each call applies
-- one batch:
--   p_sizes    [{product_id, size, stock}]  upsert product_sizes; never deletes
--   p_products [{id, stock_qty?, available?}]  only those two columns
--
-- Price, unit_price, pack_size, names, images, and content_changed_at are not
-- in the SET list. The content-change trigger leaves content_changed_at alone
-- because those columns are not updated. updated_at still moves, via the
-- existing products_set_updated_at trigger.
--
-- product_sizes writes fire sync_product_stock(), which sets stock_qty to the
-- sum of sizes. Pass stock_qty in p_products when that sum is not the repo
-- stockQty; the product update runs after the size upsert so it wins.
-- Sizes that exist only in the database are zeroed by the caller (stock = 0),
-- not deleted.

create or replace function public.apply_repo_stock_batch(
  p_sizes jsonb default '[]'::jsonb,
  p_products jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  size_count integer := 0;
  product_count integer := 0;
begin
  if p_sizes is null or jsonb_typeof(p_sizes) <> 'array' then
    raise exception 'p_sizes must be a json array';
  end if;
  if p_products is null or jsonb_typeof(p_products) <> 'array' then
    raise exception 'p_products must be a json array';
  end if;
  if jsonb_array_length(p_sizes) > 1000 or jsonb_array_length(p_products) > 1000 then
    raise exception 'batch exceeds 1000 rows';
  end if;

  perform set_config('statement_timeout', '30s', true);

  insert into public.product_sizes (product_id, size, stock)
  select
    r->>'product_id',
    r->>'size',
    greatest(coalesce((r->>'stock')::integer, 0), 0)
  from jsonb_array_elements(p_sizes) as t(r)
  where coalesce(r->>'product_id', '') <> ''
    and coalesce(r->>'size', '') <> ''
  on conflict (product_id, size) do update
    set stock = excluded.stock
    where public.product_sizes.stock is distinct from excluded.stock;

  get diagnostics size_count = row_count;

  update public.products as p
  set
    stock_qty = case
      when r ? 'stock_qty' then greatest(coalesce((r->>'stock_qty')::integer, 0), 0)
      else p.stock_qty
    end,
    available = case
      when r ? 'available' then coalesce((r->>'available')::boolean, p.available)
      else p.available
    end
  from jsonb_array_elements(p_products) as t(r)
  where p.id = r->>'id'
    and (
      (
        r ? 'stock_qty'
        and p.stock_qty is distinct from greatest(coalesce((r->>'stock_qty')::integer, 0), 0)
      )
      or (
        r ? 'available'
        and p.available is distinct from coalesce((r->>'available')::boolean, p.available)
      )
    );

  get diagnostics product_count = row_count;

  return jsonb_build_object('sizes', size_count, 'products', product_count);
end;
$$;

revoke all on function public.apply_repo_stock_batch(jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.apply_repo_stock_batch(jsonb, jsonb) to service_role;
