-- Store-opening questionnaire: leads, their personal 5% coupons, and the
-- emails sent to them. Written only by the server (service role); admins read.

create table if not exists public.opening_leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null,
  email text not null,
  whatsapp text not null,
  town text not null,
  sports text[] not null default '{}',
  buys_for text[] not null default '{}',
  wants text[] not null default '{}',
  spend text,
  wish_code text,
  draws text[] not null default '{}',
  org_name text,
  org_role text,
  org_size text,
  notes text,
  marketing_consent boolean not null default false,
  privacy_consent boolean not null default false,
  unsubscribed_at timestamptz,
  constraint opening_leads_email_lower check (email = lower(email)),
  constraint opening_leads_whatsapp_digits check (whatsapp ~ '^[0-9]{7,15}$')
);

create unique index if not exists opening_leads_email_key on public.opening_leads (email);
create unique index if not exists opening_leads_whatsapp_key on public.opening_leads (whatsapp);

create table if not exists public.opening_coupons (
  code text primary key,
  lead_id uuid not null unique references public.opening_leads (id) on delete cascade,
  created_at timestamptz not null default now(),
  rate numeric(5, 2) not null default 5,
  valid_from timestamptz not null default '2027-01-05 00:00:00+02',
  valid_until timestamptz not null default '2027-02-01 00:00:00+02',
  redeemed_at timestamptz,
  redeemed_by text,
  redeemed_channel text,
  order_id text references public.orders (id) on delete set null,
  constraint opening_coupons_rate_check check (rate > 0 and rate <= 100),
  constraint opening_coupons_channel_check check (redeemed_channel is null or redeemed_channel in ('store', 'online')),
  constraint opening_coupons_code_shape check (code ~ '^RSH-OPEN-[A-Z0-9]{6}$')
);

create table if not exists public.opening_emails (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.opening_leads (id) on delete cascade,
  kind text not null,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  error text,
  unique (lead_id, kind)
);

alter table public.opening_leads enable row level security;
alter table public.opening_coupons enable row level security;
alter table public.opening_emails enable row level security;

drop policy if exists "Admins read opening leads" on public.opening_leads;
create policy "Admins read opening leads" on public.opening_leads for select
  to authenticated using ((select public.is_admin()));

drop policy if exists "Admins read opening coupons" on public.opening_coupons;
create policy "Admins read opening coupons" on public.opening_coupons for select
  to authenticated using ((select public.is_admin()));

drop policy if exists "Admins read opening emails" on public.opening_emails;
create policy "Admins read opening emails" on public.opening_emails for select
  to authenticated using ((select public.is_admin()));

revoke all on public.opening_leads, public.opening_coupons, public.opening_emails from anon;
revoke insert, update, delete on public.opening_leads, public.opening_coupons, public.opening_emails from authenticated;
grant select on public.opening_leads, public.opening_coupons, public.opening_emails to authenticated;
