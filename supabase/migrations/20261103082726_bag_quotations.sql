-- Numbered bag quotations. Shoppers never read this table.
-- The token column stores a SHA-256 hex digest, not the plaintext.

create table public.bag_quotations (
  id text primary key,
  created_at timestamptz not null default now(),
  email text,
  subtotal numeric(12, 2) not null,
  currency text not null default 'NAD',
  item_count integer not null,
  items jsonb not null,
  token text not null,
  emailed_at timestamptz,
  constraint bag_quotations_id_check check (
    id ~ '^Q-[0-9]{6}-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$'
  ),
  constraint bag_quotations_email_check check (email is null or char_length(email) <= 160),
  constraint bag_quotations_subtotal_check check (subtotal > 0),
  constraint bag_quotations_currency_check check (currency = 'NAD'),
  constraint bag_quotations_item_count_check check (item_count > 0),
  constraint bag_quotations_items_check check (
    jsonb_typeof(items) = 'array' and jsonb_array_length(items) > 0
  ),
  constraint bag_quotations_token_check check (token ~ '^[0-9a-f]{64}$')
);

create index bag_quotations_created_at_idx on public.bag_quotations (created_at desc);

alter table public.bag_quotations enable row level security;

revoke all on table public.bag_quotations from public, anon, authenticated;
grant select on table public.bag_quotations to authenticated;

create policy bag_quotations_admin_read
on public.bag_quotations
for select
to authenticated
using ((select public.is_admin()));
