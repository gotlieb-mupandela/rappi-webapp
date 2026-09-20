-- Store checkout cart + link paid DPO payments to orders.
alter table public.payments
  add column if not exists payload jsonb,
  add column if not exists order_id text,
  add column if not exists user_id uuid;

create index if not exists payments_order_id_idx on public.payments (order_id);
create index if not exists payments_user_id_idx on public.payments (user_id);
