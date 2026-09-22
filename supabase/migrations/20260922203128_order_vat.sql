alter table public.orders
  add column if not exists vat_rate numeric(5,2) not null default 0,
  add column if not exists vat_amount numeric(10,2) not null default 0;
