-- Admin panel: RLS write policies, place_order, storage, site_settings, set_order_status

-- ---------------------------------------------------------------------------
-- site_settings (single-row content for homepage / promotions)
-- ---------------------------------------------------------------------------
create table if not exists public.site_settings (
  id integer primary key default 1 check (id = 1),
  tagline text not null default 'EQUIP | PERFORM | INSPIRE',
  hero_title text not null default 'RAPPI SPORTS HUB',
  hero_body text not null default 'Opening shop stock across sportswear, football, court sports, and kit. Retail unit prices in Namibian dollars (N$).',
  spotlight_codes text[] not null default '{}',
  updated_at timestamptz not null default now()
);

insert into public.site_settings (id, spotlight_codes)
values (1, array['104409.484', 'TOJS2604TF', 'RR300W2680', 'C448S2715'])
on conflict (id) do nothing;

create trigger site_settings_set_updated_at
  before update on public.site_settings
  for each row execute function public.set_updated_at();

alter table public.site_settings enable row level security;

grant select on table public.site_settings to anon, authenticated;
grant select, insert, update, delete on table public.site_settings to service_role;

create policy "Site settings are public"
on public.site_settings for select
to anon, authenticated
using (true);

create policy "Admins manage site settings"
on public.site_settings for all
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

-- ---------------------------------------------------------------------------
-- Promote admin (bypasses protect_profile role lock)
-- ---------------------------------------------------------------------------
create or replace function public.protect_profile()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.id is distinct from old.id then
    raise exception 'Cannot change profile id';
  end if;
  -- Role changes only via promote_admin (security definer as table owner)
  if new.role is distinct from old.role
     and current_user not in ('postgres', 'supabase_admin') then
    raise exception 'Cannot change role';
  end if;
  return new;
end;
$$;

create or replace function public.promote_admin(p_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
begin
  update public.profiles
  set role = 'admin'
  where lower(email) = lower(trim(p_email));
  get diagnostics n = row_count;
  if n = 0 then
    raise exception 'No profile found for %', p_email;
  end if;
end;
$$;

revoke all on function public.promote_admin(text) from public, anon, authenticated;
grant execute on function public.promote_admin(text) to service_role;

-- ---------------------------------------------------------------------------
-- Admin RLS write policies
-- ---------------------------------------------------------------------------
grant select, insert, update, delete on table public.products to authenticated;
grant select, insert, update, delete on table public.product_sizes to authenticated;
grant select, insert, update, delete on table public.categories to authenticated;
grant select, insert, update, delete on table public.shipping_methods to authenticated;
grant update on table public.orders to authenticated;
grant select on table public.order_items to authenticated;

create policy "Admins manage products"
on public.products for all
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

create policy "Admins manage product sizes"
on public.product_sizes for all
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

create policy "Admins manage categories"
on public.categories for all
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

create policy "Admins manage shipping methods"
on public.shipping_methods for all
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

create policy "Admins update orders"
on public.orders for update
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

create policy "Admins select all order items"
on public.order_items for select
to authenticated
using ((select public.is_admin()));

-- profiles: admins can already select via existing policy; ensure grant covers it
-- (select already granted)

-- ---------------------------------------------------------------------------
-- set_order_status RPC
-- ---------------------------------------------------------------------------
create or replace function public.set_order_status(
  p_order_id text,
  p_status public.order_status
)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
begin
  if not (select public.is_admin()) then
    raise exception 'Not authorized';
  end if;

  update public.orders
  set status = p_status
  where id = p_order_id
  returning * into v_order;

  if v_order.id is null then
    raise exception 'Order % not found', p_order_id;
  end if;

  return v_order;
end;
$$;

revoke all on function public.set_order_status(text, public.order_status) from public, anon;
grant execute on function public.set_order_status(text, public.order_status) to authenticated;

-- ---------------------------------------------------------------------------
-- place_order (web schema column names; shipping from shipping_methods)
-- ---------------------------------------------------------------------------
create or replace function public.place_order(
  p_email text,
  p_name text,
  p_address text,
  p_city text,
  p_country text,
  p_shipping_method text,
  p_notes text,
  p_lines jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_id text;
  v_subtotal numeric := 0;
  v_shipping numeric := 0;
  v_label text;
  v_line jsonb;
  v_code text;
  v_size text;
  v_qty int;
  v_price numeric;
  v_item_name text;
  v_product_id text;
  v_stock int;
  v_items jsonb := '[]'::jsonb;
begin
  if p_lines is null or jsonb_array_length(p_lines) = 0 then
    raise exception 'Cart is empty.';
  end if;
  if coalesce(trim(p_email), '') = ''
     or coalesce(trim(p_name), '') = ''
     or coalesce(trim(p_address), '') = ''
     or coalesce(trim(p_city), '') = ''
     or coalesce(trim(p_country), '') = '' then
    raise exception 'Complete shipping details.';
  end if;

  select sm.name, sm.cost
    into v_label, v_shipping
  from public.shipping_methods sm
  where sm.id = p_shipping_method;

  if v_label is null then
    raise exception 'Invalid shipping method.';
  end if;

  v_id := 'RSH' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);

  for v_line in select value from jsonb_array_elements(p_lines)
  loop
    v_code := v_line->>'code';
    v_size := v_line->>'size';
    v_qty := coalesce((v_line->>'qty')::int, 0);
    if v_qty <= 0 then
      raise exception 'Invalid quantity.';
    end if;

    select p.id, p.price, p.name
      into v_product_id, v_price, v_item_name
    from public.products p
    where p.code = v_code;

    if v_product_id is null then
      raise exception 'Product % not found.', v_code;
    end if;

    select ps.stock into v_stock
    from public.product_sizes ps
    where ps.product_id = v_product_id and ps.size = v_size
    for update;

    if v_stock is null then
      raise exception 'Size % not available for %.', v_size, v_code;
    end if;
    if v_stock < v_qty then
      raise exception 'Only % in stock for % size %.', v_stock, v_code, v_size;
    end if;

    update public.product_sizes
      set stock = stock - v_qty
    where product_id = v_product_id and size = v_size;

    v_subtotal := v_subtotal + (v_price * v_qty);
    v_items := v_items || jsonb_build_array(jsonb_build_object(
      'code', v_code,
      'name', v_item_name,
      'size', v_size,
      'qty', v_qty,
      'price', v_price
    ));
  end loop;

  insert into public.orders (
    id, user_id, email, full_name, address, city, country,
    shipping_method, shipping_cost, subtotal, total, notes, status
  ) values (
    v_id, v_user, trim(p_email), trim(p_name), trim(p_address), trim(p_city), trim(p_country),
    v_label, v_shipping, v_subtotal, v_subtotal + v_shipping, p_notes, 'reserved'
  );

  insert into public.order_items (order_id, product_id, code, name, size, qty, unit_price)
  select v_id,
         (select id from public.products where code = line_item->>'code'),
         line_item->>'code',
         line_item->>'name',
         line_item->>'size',
         (line_item->>'qty')::int,
         (line_item->>'price')::numeric
  from jsonb_array_elements(v_items) as t(line_item);

  return jsonb_build_object(
    'id', v_id,
    'created_at', now(),
    'email', trim(p_email),
    'name', trim(p_name),
    'address', trim(p_address),
    'city', trim(p_city),
    'country', trim(p_country),
    'shipping_method', v_label,
    'shipping_cost', v_shipping,
    'subtotal', v_subtotal,
    'total', v_subtotal + v_shipping,
    'notes', p_notes,
    'status', 'reserved',
    'items', v_items
  );
end;
$$;

revoke all on function public.place_order(text, text, text, text, text, text, text, jsonb) from public;
grant execute on function public.place_order(text, text, text, text, text, text, text, jsonb) to anon, authenticated;

-- Allow guest/authenticated inserts when placing via RPC (security definer handles writes)
-- Keep customer insert policies; RPC bypasses RLS as security definer.

-- ---------------------------------------------------------------------------
-- Storage: product-images bucket
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

drop policy if exists product_images_public_read on storage.objects;
create policy product_images_public_read
  on storage.objects for select
  using (bucket_id = 'product-images');

drop policy if exists product_images_admin_insert on storage.objects;
create policy product_images_admin_insert
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'product-images'
    and (select public.is_admin())
  );

drop policy if exists product_images_admin_update on storage.objects;
create policy product_images_admin_update
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'product-images'
    and (select public.is_admin())
  )
  with check (
    bucket_id = 'product-images'
    and (select public.is_admin())
  );

drop policy if exists product_images_admin_delete on storage.objects;
create policy product_images_admin_delete
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'product-images'
    and (select public.is_admin())
  );
