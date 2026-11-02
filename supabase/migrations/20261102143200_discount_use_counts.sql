-- Admin-only count of orders that applied each discount code.
-- security invoker so row access stays with the caller; non-admins get no rows.

create or replace function public.discount_use_counts()
returns table (code text, used_count bigint)
language plpgsql
stable
security invoker
set search_path = public
as $$
begin
  if not (select public.is_admin()) then
    return;
  end if;

  return query
  select o.discount_code, count(*)::bigint
  from public.orders o
  where o.discount_code is not null
    and o.discount_amount > 0
  group by o.discount_code;
end;
$$;

revoke all on function public.discount_use_counts() from public, anon;
grant execute on function public.discount_use_counts() to authenticated;
