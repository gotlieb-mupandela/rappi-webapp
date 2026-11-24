-- Automatic order updates: delivery promise, courier/tracking, "delivered" status,
-- and a log of every customer/staff email sent about an order.

alter type public.order_status add value if not exists 'delivered' after 'shipped';

-- Working days each delivery option promises (used for orders.due_at).
alter table public.shipping_methods add column if not exists max_days integer;
update public.shipping_methods set max_days = 8 where id = 'standard' and max_days is null;
update public.shipping_methods set max_days = 3 where id = 'express' and max_days is null;
update public.shipping_methods set max_days = 2 where id = 'pickup' and max_days is null;

alter table public.orders
  add column if not exists due_at timestamptz,
  add column if not exists courier text,
  add column if not exists tracking_number text;

-- End of the n-th working day (Mon-Fri) after p_from, Windhoek time.
create or replace function public.add_business_days(p_from timestamptz, p_days integer)
returns timestamptz
language plpgsql
stable
set search_path = public
as $$
declare
  d date := (p_from at time zone 'Africa/Windhoek')::date;
  n integer := 0;
begin
  while n < greatest(coalesce(p_days, 0), 0) loop
    d := d + 1;
    if extract(isodow from d) < 6 then
      n := n + 1;
    end if;
  end loop;
  return (d::timestamp + time '23:59:59') at time zone 'Africa/Windhoek';
end;
$$;

-- orders.shipping_method holds the method's name (e.g. "Express (2–3 days)").
create or replace function public.order_due_days(p_shipping_method text)
returns integer
language sql
stable
set search_path = public
as $$
  select coalesce(
    (select sm.max_days from public.shipping_methods sm
      where sm.name = p_shipping_method or sm.id = p_shipping_method
      limit 1),
    8
  );
$$;

create or replace function public.set_order_due_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.due_at is null then
    new.due_at := public.add_business_days(
      coalesce(new.created_at, now()),
      public.order_due_days(new.shipping_method)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists orders_set_due_at on public.orders;
create trigger orders_set_due_at
  before insert on public.orders
  for each row execute function public.set_order_due_at();

update public.orders
set due_at = public.add_business_days(created_at, public.order_due_days(shipping_method))
where due_at is null;

-- One row per message per order: makes sends idempotent and gives Admin a log.
create table if not exists public.order_notifications (
  id uuid primary key default gen_random_uuid(),
  order_id text not null references public.orders (id) on delete cascade,
  kind text not null,
  recipient text not null default '',
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  error text,
  unique (order_id, kind)
);

alter table public.order_notifications enable row level security;

drop policy if exists "Admins read order notifications" on public.order_notifications;
create policy "Admins read order notifications"
on public.order_notifications for select
to authenticated
using ((select public.is_admin()));

revoke insert, update, delete on public.order_notifications from anon, authenticated;

-- set_order_status gains optional courier / tracking number.
drop function if exists public.set_order_status(text, public.order_status);

create or replace function public.set_order_status(
  p_order_id text,
  p_status public.order_status,
  p_courier text default null,
  p_tracking text default null
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
  set status = p_status,
      courier = coalesce(nullif(btrim(p_courier), ''), courier),
      tracking_number = coalesce(nullif(btrim(p_tracking), ''), tracking_number)
  where id = p_order_id
  returning * into v_order;

  if v_order.id is null then
    raise exception 'Order % not found', p_order_id;
  end if;

  return v_order;
end;
$$;

revoke all on function public.set_order_status(text, public.order_status, text, text) from public, anon;
grant execute on function public.set_order_status(text, public.order_status, text, text) to authenticated;
