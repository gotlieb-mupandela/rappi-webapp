-- DPO Pay sandbox: payments ledger + DPO Test product (not in baked catalog).

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'dpo',
  company_ref text not null unique,
  trans_token text,
  trans_ref text,
  product_code text not null,
  amount numeric(10, 2) not null check (amount >= 0),
  currency text not null default 'NAD',
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'cancelled', 'expired', 'declined', 'error')),
  customer_email text,
  customer_name text,
  verify_result text,
  raw_verify text,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index payments_trans_token_idx on public.payments (trans_token);
create index payments_status_idx on public.payments (status);
create index payments_created_at_idx on public.payments (created_at desc);

create trigger payments_set_updated_at
  before update on public.payments
  for each row execute function public.set_updated_at();

alter table public.payments enable row level security;

revoke all on table public.payments from public, anon, authenticated;
grant select, insert, update on table public.payments to service_role;
grant select on table public.payments to authenticated;

create policy "Admins can view payments"
on public.payments for select
to authenticated
using ((select public.is_admin()));

insert into public.products (
  id, code, item, title, name, display_name,
  category_slug, subcategory, gender,
  price, unit_price, currency, sheet_category,
  badge, image_url, images
) values (
  'dpo-test',
  'DPO-TEST',
  'DPO TEST',
  'DPO Test',
  'DPO Test',
  'DPO Test',
  'sportswear',
  'Test',
  'unisex',
  10.00,
  10.00,
  'NAD',
  'DPO',
  null,
  'https://rappisportshub.com/dpo-test.svg',
  array['https://rappisportshub.com/dpo-test.svg']
)
on conflict (id) do nothing;

insert into public.product_sizes (product_id, size, stock)
values ('dpo-test', 'ONE', 999)
on conflict (product_id, size) do nothing;
