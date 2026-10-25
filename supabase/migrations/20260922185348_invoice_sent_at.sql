alter table public.orders
  add column if not exists invoice_sent_at timestamptz,
  add column if not exists invoice_last_error text;
