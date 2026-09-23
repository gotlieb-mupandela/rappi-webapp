-- Customer cell phone collected at checkout.
alter table public.orders add column if not exists phone text;
comment on column public.orders.phone is 'Customer cell phone from checkout';
