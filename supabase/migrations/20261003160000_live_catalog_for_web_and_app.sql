-- Live catalog for website + mobile app.
-- Adds merchandising columns, paged catalog RPC, stock sync, atomic
-- order-stock decrement, Expo push tokens, and tightens RLS.

-- ---------------------------------------------------------------------------
-- Products: persist bake-only fields so the storefront can read live rows
-- ---------------------------------------------------------------------------
alter table public.products
  add column if not exists description text not null default '',
  add column if not exists hubs text[] not null default '{}',
  add column if not exists available boolean not null default true,
  add column if not exists sell_as text,
  add column if not exists pack_size integer;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'products_sell_as_check'
  ) then
    alter table public.products
      add constraint products_sell_as_check
      check (sell_as is null or sell_as in ('pack', 'assortment', 'multipack'));
  end if;
end $$;

create index if not exists products_available_category_idx
  on public.products (available, category_slug);

alter table public.orders
  add column if not exists stock_short boolean not null default false;

create index if not exists order_items_product_id_idx
  on public.order_items (product_id);
create index if not exists cart_items_product_id_idx
  on public.cart_items (product_id);
create index if not exists wishlist_items_product_id_idx
  on public.wishlist_items (product_id);

-- ---------------------------------------------------------------------------
-- Push subscriptions (was never applied remotely) + Expo token
-- ---------------------------------------------------------------------------
do $$
begin
  create type public.push_platform as enum ('web', 'ios', 'android');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text,
  expo_token text,
  p256dh text,
  auth text,
  user_agent text not null default '',
  platform public.push_platform not null default 'web',
  created_at timestamptz not null default now(),
  constraint push_subscriptions_target_check check (
    (platform = 'web' and endpoint is not null)
    or (platform in ('ios', 'android') and expo_token is not null)
  )
);

alter table public.push_subscriptions
  add column if not exists expo_token text;

alter table public.push_subscriptions
  alter column endpoint drop not null;

do $$
begin
  alter table public.push_subscriptions
    drop constraint if exists push_subscriptions_endpoint_key;
exception
  when undefined_object then null;
end $$;

create unique index if not exists push_subscriptions_endpoint_key
  on public.push_subscriptions (endpoint)
  where endpoint is not null;

create unique index if not exists push_subscriptions_expo_token_key
  on public.push_subscriptions (expo_token)
  where expo_token is not null;

create index if not exists push_subscriptions_user_id_idx
  on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

grant select, insert, update, delete on table public.push_subscriptions to authenticated;
grant select, insert, update, delete on table public.push_subscriptions to service_role;

drop policy if exists "Users manage own push subscriptions" on public.push_subscriptions;
create policy "Users manage own push subscriptions"
on public.push_subscriptions for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- Stock sync audit
-- ---------------------------------------------------------------------------
create table if not exists public.stock_sync_runs (
  id uuid primary key default gen_random_uuid(),
  filename text not null default '',
  matched integer not null default 0,
  unmatched_codes text[] not null default '{}',
  applied_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.stock_sync_runs enable row level security;

grant select, insert on table public.stock_sync_runs to authenticated;
grant all on table public.stock_sync_runs to service_role;

drop policy if exists "Admins read stock sync runs" on public.stock_sync_runs;
create policy "Admins read stock sync runs"
on public.stock_sync_runs for select
to authenticated
using ((select public.is_admin()));

drop policy if exists "Admins insert stock sync runs" on public.stock_sync_runs;
create policy "Admins insert stock sync runs"
on public.stock_sync_runs for insert
to authenticated
with check ((select public.is_admin()));

-- ---------------------------------------------------------------------------
-- Catalog upsert helpers: persist merchandising columns
-- ---------------------------------------------------------------------------
create or replace function public._sync_upsert_products(rows jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  insert into public.products (
    id, code, item, title, name, display_name, category_slug, subcategory,
    gender, price, unit_price, currency, sheet_category, badge, image_url, images,
    description, hubs, available, sell_as, pack_size
  )
  select
    r->>'id',
    r->>'code',
    r->>'item',
    r->>'title',
    r->>'name',
    r->>'display_name',
    r->>'category_slug',
    r->>'subcategory',
    (r->>'gender')::public.gender,
    coalesce((r->>'price')::numeric, 0),
    coalesce((r->>'unit_price')::numeric, 0),
    coalesce(r->>'currency', 'NAD'),
    r->>'sheet_category',
    nullif(r->>'badge', '')::public.product_badge,
    coalesce(r->>'image_url', ''),
    case
      when jsonb_typeof(r->'images') = 'array' and jsonb_array_length(r->'images') > 0 then
        (select array_agg(x) from jsonb_array_elements_text(r->'images') as t(x))
      else
        array[coalesce(r->>'image_url', '')]
    end,
    coalesce(r->>'description', ''),
    case
      when jsonb_typeof(r->'hubs') = 'array' then
        coalesce(
          (select array_agg(x) from jsonb_array_elements_text(r->'hubs') as t(x)),
          '{}'::text[]
        )
      else '{}'::text[]
    end,
    coalesce((r->>'available')::boolean, true),
    nullif(r->>'sell_as', ''),
    nullif(r->>'pack_size', '')::integer
  from jsonb_array_elements(rows) as t(r)
  on conflict (id) do update set
    code = excluded.code,
    item = excluded.item,
    title = excluded.title,
    name = excluded.name,
    display_name = excluded.display_name,
    category_slug = excluded.category_slug,
    subcategory = excluded.subcategory,
    gender = excluded.gender,
    price = excluded.price,
    unit_price = excluded.unit_price,
    currency = excluded.currency,
    sheet_category = excluded.sheet_category,
    badge = excluded.badge,
    image_url = excluded.image_url,
    images = excluded.images,
    description = excluded.description,
    hubs = excluded.hubs,
    available = excluded.available,
    sell_as = excluded.sell_as,
    pack_size = excluded.pack_size;

  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public._sync_upsert_products(jsonb) from public, anon, authenticated;
grant execute on function public._sync_upsert_products(jsonb) to service_role;

-- ---------------------------------------------------------------------------
-- Storefront catalog view + paged RPC (PostgREST caps at 1000 rows)
-- ---------------------------------------------------------------------------
create or replace view public.storefront_catalog
with (security_invoker = true) as
select
  p.id,
  p.code,
  p.item,
  p.title,
  p.name,
  p.display_name,
  p.category_slug,
  p.subcategory,
  p.gender,
  p.price,
  p.unit_price,
  p.currency,
  p.sheet_category,
  p.stock_qty,
  p.badge,
  p.image_url,
  p.images,
  p.description,
  p.hubs,
  p.available,
  p.sell_as,
  p.pack_size,
  coalesce(
    (
      select jsonb_agg(
        jsonb_build_object('size', s.size, 'stock', s.stock)
        order by s.size
      )
      from public.product_sizes s
      where s.product_id = p.id
    ),
    '[]'::jsonb
  ) as sizes
from public.products p;

grant select on public.storefront_catalog to anon, authenticated, service_role;

create or replace function public.storefront_catalog_page(
  p_offset integer default 0,
  p_limit integer default 500
)
returns setof public.storefront_catalog
language sql
stable
security invoker
set search_path = public
as $$
  select *
  from public.storefront_catalog
  order by code
  offset greatest(coalesce(p_offset, 0), 0)
  limit least(greatest(coalesce(p_limit, 500), 1), 1000);
$$;

grant execute on function public.storefront_catalog_page(integer, integer)
  to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Admin: replace sizes atomically
-- ---------------------------------------------------------------------------
create or replace function public.replace_product_sizes(
  p_product_id text,
  p_sizes jsonb
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  if not (select public.is_admin()) then
    raise exception 'Not authorized';
  end if;

  delete from public.product_sizes where product_id = p_product_id;

  insert into public.product_sizes (product_id, size, stock)
  select
    p_product_id,
    trim(r->>'size'),
    greatest(coalesce((r->>'stock')::integer, 0), 0)
  from jsonb_array_elements(coalesce(p_sizes, '[]'::jsonb)) as t(r)
  where trim(coalesce(r->>'size', '')) <> '';

  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.replace_product_sizes(text, jsonb) from public, anon;
grant execute on function public.replace_product_sizes(text, jsonb) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Admin: apply Joma stock sync
-- ---------------------------------------------------------------------------
create or replace function public.apply_stock_sync(
  p_rows jsonb,
  p_filename text default '',
  p_unmatched text[] default '{}'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row jsonb;
  v_code text;
  v_product_id text;
  v_matched integer := 0;
  v_size jsonb;
  v_run_id uuid;
begin
  if not (select public.is_admin()) then
    raise exception 'Not authorized';
  end if;

  for v_row in select value from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb))
  loop
    v_code := trim(coalesce(v_row->>'code', ''));
    if v_code = '' then
      continue;
    end if;

    select id into v_product_id from public.products where code = v_code;
    if v_product_id is null then
      continue;
    end if;

    v_matched := v_matched + 1;

    if v_row ? 'available' then
      update public.products
      set available = coalesce((v_row->>'available')::boolean, available)
      where id = v_product_id;
    end if;

    if jsonb_typeof(v_row->'sizes') = 'array' then
      for v_size in select value from jsonb_array_elements(v_row->'sizes')
      loop
        insert into public.product_sizes (product_id, size, stock)
        values (
          v_product_id,
          trim(coalesce(v_size->>'size', '')),
          greatest(coalesce((v_size->>'stock')::integer, 0), 0)
        )
        on conflict (product_id, size) do update set stock = excluded.stock;
      end loop;
    end if;

    if (v_row->>'available') = 'false' then
      update public.product_sizes set stock = 0 where product_id = v_product_id;
      update public.products set available = false where id = v_product_id;
    end if;
  end loop;

  insert into public.stock_sync_runs (filename, matched, unmatched_codes, applied_by)
  values (
    coalesce(p_filename, ''),
    v_matched,
    coalesce(p_unmatched, '{}'),
    auth.uid()
  )
  returning id into v_run_id;

  return jsonb_build_object(
    'id', v_run_id,
    'matched', v_matched,
    'unmatched', coalesce(array_length(p_unmatched, 1), 0)
  );
end;
$$;

revoke all on function public.apply_stock_sync(jsonb, text, text[]) from public, anon;
grant execute on function public.apply_stock_sync(jsonb, text, text[]) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Service role: atomic stock decrement after payment
-- ---------------------------------------------------------------------------
create or replace function public.apply_order_stock(p_order_id text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_short boolean := false;
  v_item record;
  v_stock integer;
begin
  for v_item in
    select oi.product_id, oi.size, oi.qty
    from public.order_items oi
    where oi.order_id = p_order_id
  loop
    if v_item.product_id is null then
      v_short := true;
      continue;
    end if;

    select ps.stock into v_stock
    from public.product_sizes ps
    where ps.product_id = v_item.product_id and ps.size = v_item.size
    for update;

    if not found or v_stock is null then
      v_short := true;
      continue;
    end if;

    if v_stock < v_item.qty then
      v_short := true;
    end if;

    update public.product_sizes
    set stock = greatest(stock - v_item.qty, 0)
    where product_id = v_item.product_id and size = v_item.size;
  end loop;

  update public.orders set stock_short = v_short where id = p_order_id;
  return v_short;
end;
$$;

revoke all on function public.apply_order_stock(text) from public, anon, authenticated;
grant execute on function public.apply_order_stock(text) to service_role;

-- ---------------------------------------------------------------------------
-- Security: unused place_order + split overlapping ALL policies
-- ---------------------------------------------------------------------------
revoke all on function public.place_order(text, text, text, text, text, text, text, jsonb)
  from public, anon, authenticated;

drop policy if exists "Admins manage products" on public.products;
create policy "Admins insert products"
on public.products for insert to authenticated
with check ((select public.is_admin()));
create policy "Admins update products"
on public.products for update to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));
create policy "Admins delete products"
on public.products for delete to authenticated
using ((select public.is_admin()));

drop policy if exists "Admins manage product sizes" on public.product_sizes;
create policy "Admins insert product sizes"
on public.product_sizes for insert to authenticated
with check ((select public.is_admin()));
create policy "Admins update product sizes"
on public.product_sizes for update to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));
create policy "Admins delete product sizes"
on public.product_sizes for delete to authenticated
using ((select public.is_admin()));

drop policy if exists "Admins manage categories" on public.categories;
create policy "Admins insert categories"
on public.categories for insert to authenticated
with check ((select public.is_admin()));
create policy "Admins update categories"
on public.categories for update to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));
create policy "Admins delete categories"
on public.categories for delete to authenticated
using ((select public.is_admin()));

drop policy if exists "Admins manage shipping methods" on public.shipping_methods;
create policy "Admins insert shipping methods"
on public.shipping_methods for insert to authenticated
with check ((select public.is_admin()));
create policy "Admins update shipping methods"
on public.shipping_methods for update to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));
create policy "Admins delete shipping methods"
on public.shipping_methods for delete to authenticated
using ((select public.is_admin()));

drop policy if exists "Admins manage site settings" on public.site_settings;
create policy "Admins insert site settings"
on public.site_settings for insert to authenticated
with check ((select public.is_admin()));
create policy "Admins update site settings"
on public.site_settings for update to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));
create policy "Admins delete site settings"
on public.site_settings for delete to authenticated
using ((select public.is_admin()));

drop policy if exists "Admins select all order items" on public.order_items;
