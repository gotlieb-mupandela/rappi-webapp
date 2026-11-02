-- Admin-managed checkout codes. Shoppers cannot list them; payment pricing
-- looks up one code with the service role. The rate is a percent off merchandise.

create table public.discount_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  rate numeric(5, 2) not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint discount_codes_rate_check check (rate > 0 and rate <= 100)
);

create unique index discount_codes_code_key on public.discount_codes (code);

create or replace function public.normalize_discount_code()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.code := upper(btrim(new.code));
  if new.code !~ '^[A-Z0-9][A-Z0-9_-]{1,31}$' then
    raise exception 'Discount code must be 2-32 letters, numbers, underscores, or hyphens';
  end if;
  return new;
end;
$$;

create trigger discount_codes_normalize
  before insert or update on public.discount_codes
  for each row execute function public.normalize_discount_code();

create trigger discount_codes_set_updated_at
  before update on public.discount_codes
  for each row execute function public.set_updated_at();

alter table public.discount_codes enable row level security;

revoke all on table public.discount_codes from public, anon, authenticated;
grant select, insert, update, delete on table public.discount_codes to authenticated;
grant select, insert, update, delete on table public.discount_codes to service_role;

revoke all on function public.normalize_discount_code() from public, anon;
grant execute on function public.normalize_discount_code() to authenticated, service_role;

create policy "Admins read discount codes"
on public.discount_codes for select
to authenticated
using ((select public.is_admin()));

create policy "Admins insert discount codes"
on public.discount_codes for insert
to authenticated
with check ((select public.is_admin()));

create policy "Admins update discount codes"
on public.discount_codes for update
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

create policy "Admins delete discount codes"
on public.discount_codes for delete
to authenticated
using ((select public.is_admin()));

alter table public.orders
  add column discount_code text,
  add column discount_rate numeric(5, 2) not null default 0,
  add column discount_amount numeric(10, 2) not null default 0;

alter table public.orders
  add constraint orders_discount_rate_check check (discount_rate >= 0 and discount_rate <= 100),
  add constraint orders_discount_amount_check check (discount_amount >= 0);

-- Paid orders must total the same amount DPO charged. VAT on the payload is
-- already calculated after the merchandise discount.
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
  v_discount_code text;
  v_discount_rate numeric := 0;
  v_discount numeric := 0;
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

  v_discount_code := nullif(upper(btrim(coalesce(v_payload->>'discountCode', ''))), '');
  v_discount_rate := least(greatest(coalesce((v_payload->>'discountRate')::numeric, 0), 0), 100);
  v_discount := greatest(coalesce((v_payload->>'discountAmount')::numeric, 0), 0);
  if v_discount > v_subtotal then
    v_discount := v_subtotal;
  end if;
  if v_discount_code is null or v_discount <= 0 then
    v_discount_code := null;
    v_discount_rate := 0;
    v_discount := 0;
  end if;

  v_vat_rate := coalesce((v_payload->>'vatRate')::numeric, 0);
  v_vat_amount := coalesce(
    (v_payload->>'vatAmount')::numeric,
    round((v_subtotal - v_discount + v_shipping) * v_vat_rate / 100, 2)
  );
  v_total := round(v_subtotal - v_discount + v_shipping + v_vat_amount, 2);

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
    shipping_method, shipping_cost, subtotal, discount_code, discount_rate, discount_amount,
    vat_rate, vat_amount, total, notes, status
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
    v_discount_code,
    v_discount_rate,
    v_discount,
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
