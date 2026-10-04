-- storefront_catalog_page sorted the whole view (one sizes jsonb_agg per
-- product, ~11k) before applying offset/limit, so every 500-row page cost
-- ~7s. Page the products table first, then aggregate sizes for that page only.

create or replace function public.storefront_catalog_page(
  p_offset integer default 0,
  p_limit integer default 500
)
returns setof public.storefront_catalog
language sql
stable
security invoker
set search_path = public
as $$
  with page as (
    select *
    from public.products
    order by code
    offset greatest(coalesce(p_offset, 0), 0)
    limit least(greatest(coalesce(p_limit, 500), 1), 1000)
  )
  select
    p.id,
    p.code,
    p.item,
    p.title,
    p.name,
    p.display_name,
    p.category_slug,
    p.subcategory,
    p.gender,
    p.price,
    p.unit_price,
    p.currency,
    p.sheet_category,
    p.stock_qty,
    p.badge,
    p.image_url,
    p.images,
    p.description,
    p.hubs,
    p.available,
    p.sell_as,
    p.pack_size,
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object('size', s.size, 'stock', s.stock)
          order by s.size
        )
        from public.product_sizes s
        where s.product_id = p.id
      ),
      '[]'::jsonb
    ) as sizes
  from page p
  order by p.code;
$$;

grant execute on function public.storefront_catalog_page(integer, integer)
  to anon, authenticated, service_role;
