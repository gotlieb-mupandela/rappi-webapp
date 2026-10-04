-- Close customer order inserts, lock profile email, promote by auth user,
-- delete the published demo login, fulfill a payment once, and rate-limit writes.

-- ---------------------------------------------------------------------------
-- Orders: only the service role can create rows
-- ---------------------------------------------------------------------------
drop policy if exists "Users can place own orders" on public.orders;
drop policy if exists "Users can insert own order items" on public.order_items;

revoke insert, delete, truncate on table public.orders from anon, authenticated;
revoke insert, update, delete, truncate on table public.order_items from anon, authenticated;
grant select, update on table public.orders to authenticated;
grant select on table public.order_items to authenticated;

-- ---------------------------------------------------------------------------
-- Anon may only read the public catalog
-- ---------------------------------------------------------------------------
revoke all on table public.addresses from anon;
revoke all on table public.cart_items from anon;
revoke all on table public.order_items from anon;
revoke all on table public.orders from anon;
revoke all on table public.profiles from anon;
revoke all on table public.push_subscriptions from anon;
revoke all on table public.stock_sync_runs from anon;
revoke all on table public.wishlist_items from anon;

revoke insert, update, delete, truncate on table public.categories from anon;
revoke insert, update, delete, truncate on table public.product_sizes from anon;
revoke insert, update, delete, truncate on table public.products from anon;
revoke insert, update, delete, truncate on table public.shipping_methods from anon;
revoke insert, update, delete, truncate on table public.site_settings from anon;

grant select on table public.categories to anon;
grant select on table public.product_sizes to anon;
grant select on table public.products to anon;
grant select on table public.shipping_methods to anon;
grant select on table public.site_settings to anon;

revoke insert, update, delete, truncate on table public.storefront_catalog from anon, authenticated;
grant select on table public.storefront_catalog to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Profile email is unique and not customer-writable
-- ---------------------------------------------------------------------------
create unique index if not exists profiles_email_lower_key
  on public.profiles (lower(email));

create or replace function public.protect_profile()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.id is distinct from old.id then
    raise exception 'Cannot change profile id';
  end if;
  if new.role is distinct from old.role
     and current_user not in ('postgres', 'supabase_admin') then
    raise exception 'Cannot change role';
  end if;
  if new.email is distinct from old.email
     and current_user not in ('postgres', 'supabase_admin') then
    raise exception 'Cannot change email';
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
  v_id uuid;
begin
  select u.id into v_id
  from auth.users u
  where lower(u.email) = lower(trim(p_email));

  if v_id is null then
    raise exception 'No auth user found for %', p_email;
  end if;

  update public.profiles
  set role = 'admin'
  where id = v_id;
  get diagnostics n = row_count;
  if n = 0 then
    raise exception 'No profile found for %', p_email;
  end if;
end;
$$;

revoke all on function public.promote_admin(text) from public, anon, authenticated;
grant execute on function public.promote_admin(text) to service_role;

-- ---------------------------------------------------------------------------
-- Published demo login
-- ---------------------------------------------------------------------------
delete from auth.users where lower(email) = 'shop@rappi.com';

-- ---------------------------------------------------------------------------
-- One order per paid payment
-- ---------------------------------------------------------------------------
with ranked as (
  select id, row_number() over (
    partition by order_id
    order by paid_at nulls last, created_at, id
  ) as rn
  from public.payments
  where order_id is not null
)
update public.payments p
set order_id = null
from ranked r
where p.id = r.id and r.rn > 1;

create unique index if not exists payments_order_id_key
  on public.payments (order_id)
  where order_id is not null;

create or replace function public.fulfill_paid_payment(p_payment_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public.payments;
  v_payload jsonb;
  v_order_id text;
  v_line jsonb;
  v_subtotal numeric := 0;
  v_shipping numeric := 0;
  v_shipping_label text;
  v_shipping_id text;
  v_vat_rate numeric := 0;
  v_vat_amount numeric := 0;
  v_total numeric;
  v_user uuid;
  v_email text;
  v_name text;
begin
  select * into v_payment
  from public.payments
  where id = p_payment_id
  for update;

  if not found then
    raise exception 'Payment not found';
  end if;

  if v_payment.order_id is not null then
    return v_payment.order_id;
  end if;

  v_payload := v_payment.payload;
  if v_payload is null
     or jsonb_typeof(v_payload->'lines') <> 'array'
     or jsonb_array_length(v_payload->'lines') = 0 then
    return null;
  end if;

  v_shipping_id := coalesce(v_payload->>'shippingMethod', '');
  select sm.name, sm.cost
    into v_shipping_label, v_shipping
  from public.shipping_methods sm
  where sm.id = v_shipping_id;

  if v_shipping_label is null then
    v_shipping_label := coalesce(nullif(v_shipping_id, ''), 'standard');
    v_shipping := coalesce((v_payload->>'shippingCost')::numeric, 0);
  end if;

  for v_line in select value from jsonb_array_elements(v_payload->'lines')
  loop
    v_subtotal := v_subtotal
      + coalesce((v_line->>'price')::numeric, 0)
      * coalesce((v_line->>'qty')::int, 0);
  end loop;

  v_vat_rate := coalesce((v_payload->>'vatRate')::numeric, 0);
  v_vat_amount := coalesce(
    (v_payload->>'vatAmount')::numeric,
    round((v_subtotal + v_shipping) * v_vat_rate / 100, 2)
  );
  v_total := round(v_subtotal + v_shipping + v_vat_amount, 2);

  if (v_payload->>'userId') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    v_user := (v_payload->>'userId')::uuid;
  else
    v_user := v_payment.user_id;
  end if;

  v_email := coalesce(nullif(trim(v_payload->>'email'), ''), v_payment.customer_email, '');
  v_name := coalesce(nullif(trim(v_payload->>'name'), ''), v_payment.customer_name, '');
  if v_email = '' or v_name = '' then
    raise exception 'Payment is missing customer details.';
  end if;

  v_order_id := 'RSH' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));

  insert into public.orders (
    id, user_id, email, full_name, phone, address, city, country,
    shipping_method, shipping_cost, subtotal, vat_rate, vat_amount, total, notes, status
  ) values (
    v_order_id,
    v_user,
    v_email,
    v_name,
    nullif(trim(v_payload->>'phone'), ''),
    coalesce(trim(v_payload->>'address'), ''),
    coalesce(trim(v_payload->>'city'), ''),
    coalesce(nullif(trim(v_payload->>'country'), ''), 'Namibia'),
    v_shipping_label,
    v_shipping,
    v_subtotal,
    v_vat_rate,
    v_vat_amount,
    v_total,
    nullif(v_payload->>'notes', ''),
    'reserved'
  );

  insert into public.order_items (order_id, product_id, code, name, size, qty, unit_price)
  select
    v_order_id,
    (select p.id from public.products p where p.code = line->>'code'),
    coalesce(line->>'code', ''),
    coalesce(line->>'name', line->>'code', ''),
    coalesce(line->>'size', ''),
    greatest(coalesce((line->>'qty')::int, 0), 1),
    greatest(coalesce((line->>'price')::numeric, 0), 0)
  from jsonb_array_elements(v_payload->'lines') as t(line);

  perform public.apply_order_stock(v_order_id);

  update public.payments
  set order_id = v_order_id
  where id = p_payment_id
    and order_id is null;

  return coalesce(
    (select order_id from public.payments where id = p_payment_id),
    v_order_id
  );
end;
$$;

revoke all on function public.fulfill_paid_payment(uuid) from public, anon, authenticated;
grant execute on function public.fulfill_paid_payment(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- Rate limits for public write routes
-- ---------------------------------------------------------------------------
create table if not exists public.rate_limits (
  key text primary key,
  window_start timestamptz not null,
  hits integer not null default 0
);

alter table public.rate_limits enable row level security;

revoke all on table public.rate_limits from public, anon, authenticated;
grant all on table public.rate_limits to service_role;

create or replace function public.consume_rate_limit(
  p_key text,
  p_max integer,
  p_window_seconds integer default 3600
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hits integer;
  v_window interval;
begin
  if coalesce(trim(p_key), '') = '' then
    return false;
  end if;
  if p_max < 1 or coalesce(p_window_seconds, 0) < 1 then
    return false;
  end if;

  v_window := make_interval(secs => p_window_seconds);

  insert into public.rate_limits (key, window_start, hits)
  values (trim(p_key), now(), 1)
  on conflict (key) do update
    set hits = case
      when public.rate_limits.window_start <= now() - v_window then 1
      else public.rate_limits.hits + 1
    end,
        window_start = case
      when public.rate_limits.window_start <= now() - v_window then now()
      else public.rate_limits.window_start
    end
  returning hits into v_hits;

  return v_hits <= p_max;
end;
$$;

revoke all on function public.consume_rate_limit(text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.consume_rate_limit(text, integer, integer)
  to service_role;
