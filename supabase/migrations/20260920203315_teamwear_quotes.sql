create table public.teamwear_quotes (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null,
  email text not null,
  organisation text not null default '',
  sport text not null default '',
  players text not null default '',
  sizes text not null default '',
  notes text not null default '',
  status text not null default 'new'
);

alter table public.teamwear_quotes enable row level security;

revoke all on table public.teamwear_quotes from public, anon, authenticated;
grant select on table public.teamwear_quotes to authenticated;

create policy teamwear_quotes_admin_read
on public.teamwear_quotes
for select
to authenticated
using ((select public.is_admin()));
