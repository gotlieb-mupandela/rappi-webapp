-- DPO card payments take about 3 business days to reach the RAPPI Investments bank account.
-- Dispatch and Hub pickup only start once the money has cleared, so every expected date
-- (delivery and pickup) now counts 3 business days for clearing plus the shipping method's days.
-- Existing orders keep the date they were already promised.
create or replace function public.order_due_days(p_shipping_method text)
returns integer
language sql
stable
set search_path = public
as $$
  select 3 + coalesce(
    (select sm.max_days from public.shipping_methods sm
      where sm.name = p_shipping_method or sm.id = p_shipping_method
      limit 1),
    8
  );
$$;
