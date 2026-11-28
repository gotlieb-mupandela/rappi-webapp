-- Online layby (Terms clause 7): 20% deposit by card, then any payments of N$100+ within 3 months.
-- The order is created with status 'layby' at the deposit, so its stock is reserved, and becomes
-- 'reserved' (normal paid order) once fully paid. Writes go through the functions below (service role).

create table if not exists public.laybys (
  id text primary key,
  order_id text not null unique references public.orders (id) on delete restrict,
  user_id uuid references auth.users (id) on delete set null,
  email text not null,
  name text not null,
  phone text,
  total numeric(12,2) not null check (total > 0),
  paid numeric(12,2) not null default 0 check (paid >= 0),
  opened_at timestamptz not null default now(),
  final_due_at timestamptz not null,
  last_payment_at timestamptz,
  status text not null default 'active' check (status in ('active', 'paid', 'cancelled')),
  accepted_at timestamptz,
  accepted_ip text,
  completed_at timestamptz,
  cancelled_at timestamptz,
  cancelled_by text,
  cancel_reason text,
  cancel_fee numeric(12,2),
  refund_amount numeric(12,2),
  refund_done_at timestamptz,
  refund_done_by text
);
create index if not exists laybys_user_idx on public.laybys (user_id);
create index if not exists laybys_status_idx on public.laybys (status, final_due_at);

create table if not exists public.layby_payments (
  id uuid primary key default gen_random_uuid(),
  layby_id text not null references public.laybys (id) on delete cascade,
  payment_id uuid unique references public.payments (id) on delete set null,
  amount numeric(12,2) not null check (amount > 0),
  method text not null check (method in ('card', 'cash', 'eft')),
  kind text not null default 'instalment' check (kind in ('deposit', 'instalment')),
  recorded_by text,
  created_at timestamptz not null default now()
);
create index if not exists layby_payments_layby_idx on public.layby_payments (layby_id, created_at);

create table if not exists public.layby_notifications (
  id uuid primary key default gen_random_uuid(),
  layby_id text not null references public.laybys (id) on delete cascade,
  kind text not null,
  recipient text not null default '',
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  error text,
  unique (layby_id, kind)
);

alter table public.laybys enable row level security;
alter table public.layby_payments enable row level security;
alter table public.layby_notifications enable row level security;

drop policy if exists "Customers read own laybys" on public.laybys;
create policy "Customers read own laybys" on public.laybys for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));
drop policy if exists "Customers read own layby payments" on public.layby_payments;
create policy "Customers read own layby payments" on public.layby_payments for select to authenticated
  using (exists (select 1 from public.laybys l where l.id = layby_id and (l.user_id = (select auth.uid()) or (select public.is_admin()))));
drop policy if exists "Admins read layby notifications" on public.layby_notifications;
create policy "Admins read layby notifications" on public.layby_notifications for select to authenticated
  using ((select public.is_admin()));

grant select on public.laybys, public.layby_payments, public.layby_notifications to authenticated;
grant all on public.laybys, public.layby_payments, public.layby_notifications to service_role;

-- Adds a payment to an active layby. Completes it (order becomes a normal paid order) when the
-- balance reaches zero. Returns the layby row. Idempotent per card payment (unique payment_id).
create or replace function public.layby_add_payment(
  p_layby_id text,
  p_amount numeric,
  p_method text,
  p_payment_id uuid default null,
  p_recorded_by text default null,
  p_kind text default 'instalment'
)
returns public.laybys
language plpgsql
security definer
set search_path = public
as $$
declare
  v_layby public.laybys;
  v_order public.orders;
  v_inserted uuid;
begin
  select * into v_layby from public.laybys where id = p_layby_id for update;
  if not found then
    raise exception 'Layby % not found', p_layby_id;
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Amount must be positive';
  end if;

  if p_payment_id is not null and exists (select 1 from public.layby_payments where payment_id = p_payment_id) then
    return v_layby;
  end if;
  if v_layby.status <> 'active' then
    -- A card payment that arrives after completion or cancellation is still recorded so staff can refund it.
    if p_payment_id is null then
      raise exception 'Layby % is %', p_layby_id, v_layby.status;
    end if;
  end if;

  insert into public.layby_payments (layby_id, payment_id, amount, method, kind, recorded_by)
  values (p_layby_id, p_payment_id, round(p_amount, 2), p_method, p_kind, p_recorded_by)
  returning id into v_inserted;

  update public.laybys
  set paid = round(paid + p_amount, 2),
      last_payment_at = now()
  where id = p_layby_id
  returning * into v_layby;

  if v_layby.status = 'active' and v_layby.paid >= v_layby.total - 0.004 then
    select * into v_order from public.orders where id = v_layby.order_id for update;
    update public.orders
    set status = 'reserved',
        due_at = public.add_business_days(now(), public.order_due_days(v_order.shipping_method))
    where id = v_layby.order_id;
    update public.laybys set status = 'paid', completed_at = now() where id = p_layby_id
    returning * into v_layby;
  end if;

  return v_layby;
end;
$$;

-- Creates the layby order (status 'layby', stock reserved) and the layby from a paid deposit payment.
-- Returns the layby id. Idempotent: a second call returns the existing layby.
create or replace function public.open_layby_from_payment(p_payment_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public.payments;
  v_payload jsonb;
  v_layby_id text;
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
  select * into v_payment from public.payments where id = p_payment_id for update;
  if not found then
    raise exception 'Payment not found';
  end if;
  if v_payment.status <> 'paid' then
    raise exception 'Payment is not paid';
  end if;

  if v_payment.order_id is not null then
    select id into v_layby_id from public.laybys where order_id = v_payment.order_id;
    return v_layby_id;
  end if;

  v_payload := v_payment.payload;
  if v_payload is null or coalesce(v_payload->'layby'->>'kind', '') <> 'deposit'
     or jsonb_typeof(v_payload->'lines') <> 'array' or jsonb_array_length(v_payload->'lines') = 0 then
    raise exception 'Not a layby deposit payment';
  end if;

  v_shipping_id := coalesce(v_payload->>'shippingMethod', '');
  select sm.name, sm.cost into v_shipping_label, v_shipping from public.shipping_methods sm where sm.id = v_shipping_id;
  if v_shipping_label is null then
    v_shipping_label := coalesce(nullif(v_shipping_id, ''), 'standard');
    v_shipping := coalesce((v_payload->>'shippingCost')::numeric, 0);
  end if;

  for v_line in select value from jsonb_array_elements(v_payload->'lines') loop
    v_subtotal := v_subtotal + coalesce((v_line->>'price')::numeric, 0) * coalesce((v_line->>'qty')::int, 0);
  end loop;

  v_vat_rate := coalesce((v_payload->>'vatRate')::numeric, 0);
  v_vat_amount := coalesce((v_payload->>'vatAmount')::numeric, round((v_subtotal + v_shipping) * v_vat_rate / 100, 2));
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
  v_layby_id := 'LB-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));

  insert into public.orders (
    id, user_id, email, full_name, phone, address, city, country,
    shipping_method, shipping_cost, subtotal, discount_code, discount_rate, discount_amount,
    vat_rate, vat_amount, total, notes, status, due_at
  ) values (
    v_order_id, v_user, v_email, v_name,
    nullif(trim(v_payload->>'phone'), ''),
    coalesce(trim(v_payload->>'address'), ''),
    coalesce(trim(v_payload->>'city'), ''),
    coalesce(nullif(trim(v_payload->>'country'), ''), 'Namibia'),
    v_shipping_label, v_shipping, v_subtotal, null, 0, 0,
    v_vat_rate, v_vat_amount, v_total,
    trim(both from concat_ws(E'\n\n', nullif(v_payload->>'notes', ''), 'LAYBY ' || v_layby_id || ': do not pack or send until fully paid.')),
    'layby', null
  );
  -- The due-date trigger fills due_at on insert; a layby has no delivery date until it is paid.
  update public.orders set due_at = null where id = v_order_id;

  insert into public.order_items (order_id, product_id, code, name, size, qty, unit_price)
  select v_order_id,
    (select p.id from public.products p where p.code = line->>'code'),
    coalesce(line->>'code', ''), coalesce(line->>'name', line->>'code', ''), coalesce(line->>'size', ''),
    greatest(coalesce((line->>'qty')::int, 0), 1), greatest(coalesce((line->>'price')::numeric, 0), 0)
  from jsonb_array_elements(v_payload->'lines') as t(line);

  perform public.apply_order_stock(v_order_id);

  insert into public.laybys (id, order_id, user_id, email, name, phone, total, paid, opened_at, final_due_at, accepted_at, accepted_ip)
  values (
    v_layby_id, v_order_id, v_user, v_email, v_name, nullif(trim(v_payload->>'phone'), ''),
    v_total, 0, now(), now() + interval '3 months',
    coalesce((v_payload->'layby'->>'acceptedAt')::timestamptz, now()),
    nullif(v_payload->'layby'->>'ip', '')
  );

  update public.payments set order_id = v_order_id where id = p_payment_id and order_id is null;

  perform public.layby_add_payment(v_layby_id, v_payment.amount, 'card', p_payment_id, null, 'deposit');
  return v_layby_id;
end;
$$;

-- Card instalment: records a paid DPO payment against its layby.
create or replace function public.apply_layby_payment(p_payment_id uuid)
returns public.laybys
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public.payments;
  v_layby_id text;
begin
  select * into v_payment from public.payments where id = p_payment_id for update;
  if not found then
    raise exception 'Payment not found';
  end if;
  if v_payment.status <> 'paid' then
    raise exception 'Payment is not paid';
  end if;
  v_layby_id := v_payment.payload->'layby'->>'laybyId';
  if coalesce(v_payment.payload->'layby'->>'kind', '') <> 'instalment' or v_layby_id is null then
    raise exception 'Not a layby instalment payment';
  end if;
  return public.layby_add_payment(v_layby_id, v_payment.amount, 'card', p_payment_id, null, 'instalment');
end;
$$;

-- Cancels an active layby: fee = min(30% of the total, amount paid); refund = paid - fee.
-- Puts the reserved stock back and cancels the order. Staff pay the refund by hand.
create or replace function public.cancel_layby(p_layby_id text, p_reason text, p_by text)
returns public.laybys
language plpgsql
security definer
set search_path = public
as $$
declare
  v_layby public.laybys;
  v_fee numeric;
  v_item record;
begin
  select * into v_layby from public.laybys where id = p_layby_id for update;
  if not found then
    raise exception 'Layby % not found', p_layby_id;
  end if;
  if v_layby.status <> 'active' then
    raise exception 'Layby % is %', p_layby_id, v_layby.status;
  end if;

  v_fee := least(round(v_layby.total * 0.30, 2), v_layby.paid);

  for v_item in select oi.product_id, oi.size, oi.qty from public.order_items oi where oi.order_id = v_layby.order_id loop
    if v_item.product_id is not null then
      update public.product_sizes set stock = stock + v_item.qty
      where product_id = v_item.product_id and size = v_item.size;
    end if;
  end loop;

  update public.orders set status = 'cancelled' where id = v_layby.order_id;

  update public.laybys
  set status = 'cancelled', cancelled_at = now(), cancelled_by = nullif(btrim(p_by), ''),
      cancel_reason = nullif(btrim(p_reason), ''), cancel_fee = v_fee,
      refund_amount = round(v_layby.paid - v_fee, 2),
      refund_done_at = case when v_layby.paid - v_fee <= 0 then now() else null end
  where id = p_layby_id
  returning * into v_layby;
  return v_layby;
end;
$$;

revoke all on function public.layby_add_payment(text, numeric, text, uuid, text, text) from public, anon, authenticated;
revoke all on function public.open_layby_from_payment(uuid) from public, anon, authenticated;
revoke all on function public.apply_layby_payment(uuid) from public, anon, authenticated;
revoke all on function public.cancel_layby(text, text, text) from public, anon, authenticated;
grant execute on function public.layby_add_payment(text, numeric, text, uuid, text, text) to service_role;
grant execute on function public.open_layby_from_payment(uuid) to service_role;
grant execute on function public.apply_layby_payment(uuid) to service_role;
grant execute on function public.cancel_layby(text, text, text) to service_role;
