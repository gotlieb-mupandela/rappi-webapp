-- Self-service account deletion for the website and app.
-- Profiles, addresses, cart, wishlist and push tokens cascade from auth.users.
-- Orders keep their rows (orders.user_id is set null) for tax records.
-- payments.user_id has no foreign key, so it is unlinked here.
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'Sign in required.' using errcode = '28000';
  end if;

  if public.is_admin() then
    raise exception 'Admin accounts cannot be deleted from the store.' using errcode = '42501';
  end if;

  update public.payments set user_id = null where user_id = v_user;
  delete from auth.users where id = v_user;
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
