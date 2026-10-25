-- Web and native push endpoints, keyed per signed-in user.
create type public.push_platform as enum ('web', 'ios', 'android');

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null unique,
  p256dh text,
  auth text,
  user_agent text not null default '',
  platform public.push_platform not null default 'web',
  created_at timestamptz not null default now()
);

create index push_subscriptions_user_id_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

grant select, insert, update, delete on table public.push_subscriptions to authenticated;
grant select, insert, update, delete on table public.push_subscriptions to service_role;

create policy "Users manage own push subscriptions"
on public.push_subscriptions for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
