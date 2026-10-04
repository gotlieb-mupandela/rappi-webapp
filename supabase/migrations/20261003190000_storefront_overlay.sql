-- Slim live overlay for the storefront: price, stock, sizes and visibility for every
-- product (~1MB) instead of the full 14MB catalog. Full rows are only needed for
-- products whose content was edited after the bake (content_changed_at is set).

alter table public.products
  add column if not exists content_changed_at timestamptz;

create or replace function public.products_track_content_change()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.content_changed_at := coalesce(new.content_changed_at, now());
  elsif (new.item, new.title, new.name, new.display_name, new.category_slug,
         new.subcategory, new.gender, new.unit_price, new.sheet_category, new.badge,
         new.image_url, new.images, new.description, new.hubs, new.sell_as, new.pack_size)
        is distinct from
        (old.item, old.title, old.name, old.display_name, old.category_slug,
         old.subcategory, old.gender, old.unit_price, old.sheet_category, old.badge,
         old.image_url, old.images, old.description, old.hubs, old.sell_as, old.pack_size) then
    new.content_changed_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists products_track_content_change on public.products;
create trigger products_track_content_change
  before insert or update on public.products
  for each row execute function public.products_track_content_change();

-- Everything currently in the table matches data/products.json (backfilled from the bake).
update public.products set content_changed_at = null where content_changed_at is not null;

create index if not exists products_content_changed_idx
  on public.products (content_changed_at)
  where content_changed_at is not null;

-- One row per product: [code, price, available, stock_qty, "S:3|M:0", content_changed]
create or replace function public.storefront_overlay()
returns jsonb
language sql
stable
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_array(
    p.code,
    p.price,
    p.available,
    p.stock_qty,
    coalesce((
      select string_agg(s.size || ':' || s.stock, '|' order by s.size)
      from public.product_sizes s
      where s.product_id = p.id
    ), ''),
    p.content_changed_at is not null
  )), '[]'::jsonb)
  from public.products p;
$$;

grant execute on function public.storefront_overlay() to anon, authenticated, service_role;
