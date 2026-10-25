-- Fix place_order: jsonb_array_elements alias must be a jsonb column, not a table alias.
-- `as item` made `item->>'code'` resolve as text ->> unknown.
create or replace function public.place_order(
  p_email text,
  p_name text,
  p_address text,
  p_city text,
  p_country text,
  p_shipping_method text,
  p_notes text,
  p_lines jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_id text;
  v_subtotal numeric := 0;
  v_shipping numeric := 0;
  v_label text;
  v_line jsonb;
  v_code text;
  v_size text;
  v_qty int;
  v_price numeric;
  v_item_name text;
  v_product_id text;
  v_stock int;
  v_items jsonb := '[]'::jsonb;
begin
  if p_lines is null or jsonb_array_length(p_lines) = 0 then
    raise exception 'Cart is empty.';
  end if;
  if coalesce(trim(p_email), '') = ''
     or coalesce(trim(p_name), '') = ''
     or coalesce(trim(p_address), '') = ''
     or coalesce(trim(p_city), '') = ''
     or coalesce(trim(p_country), '') = '' then
    raise exception 'Complete shipping details.';
  end if;

  select sm.name, sm.cost
    into v_label, v_shipping
  from public.shipping_methods sm
  where sm.id = p_shipping_method;

  if v_label is null then
    raise exception 'Invalid shipping method.';
  end if;

  v_id := 'RSH' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);

  for v_line in select value from jsonb_array_elements(p_lines)
  loop
    v_code := v_line->>'code';
    v_size := v_line->>'size';
    v_qty := coalesce((v_line->>'qty')::int, 0);
    if v_qty <= 0 then
      raise exception 'Invalid quantity.';
    end if;

    select p.id, p.price, p.name
      into v_product_id, v_price, v_item_name
    from public.products p
    where p.code = v_code;

    if v_product_id is null then
      raise exception 'Product % not found.', v_code;
    end if;

    select ps.stock into v_stock
    from public.product_sizes ps
    where ps.product_id = v_product_id and ps.size = v_size
    for update;

    if v_stock is null then
      raise exception 'Size % not available for %.', v_size, v_code;
    end if;
    if v_stock < v_qty then
      raise exception 'Only % in stock for % size %.', v_stock, v_code, v_size;
    end if;

    update public.product_sizes
      set stock = stock - v_qty
    where product_id = v_product_id and size = v_size;

    v_subtotal := v_subtotal + (v_price * v_qty);
    v_items := v_items || jsonb_build_array(jsonb_build_object(
      'code', v_code,
      'name', v_item_name,
      'size', v_size,
      'qty', v_qty,
      'price', v_price
    ));
  end loop;

  insert into public.orders (
    id, user_id, email, full_name, address, city, country,
    shipping_method, shipping_cost, subtotal, total, notes, status
  ) values (
    v_id, v_user, trim(p_email), trim(p_name), trim(p_address), trim(p_city), trim(p_country),
    v_label, v_shipping, v_subtotal, v_subtotal + v_shipping, p_notes, 'reserved'
  );

  insert into public.order_items (order_id, product_id, code, name, size, qty, unit_price)
  select v_id,
         (select id from public.products where code = line_item->>'code'),
         line_item->>'code',
         line_item->>'name',
         line_item->>'size',
         (line_item->>'qty')::int,
         (line_item->>'price')::numeric
  from jsonb_array_elements(v_items) as t(line_item);

  return jsonb_build_object(
    'id', v_id,
    'created_at', now(),
    'email', trim(p_email),
    'name', trim(p_name),
    'address', trim(p_address),
    'city', trim(p_city),
    'country', trim(p_country),
    'shipping_method', v_label,
    'shipping_cost', v_shipping,
    'subtotal', v_subtotal,
    'total', v_subtotal + v_shipping,
    'notes', p_notes,
    'status', 'reserved',
    'items', v_items
  );
end;
$$;

revoke all on function public.place_order(text, text, text, text, text, text, text, jsonb) from public;
grant execute on function public.place_order(text, text, text, text, text, text, text, jsonb) to anon, authenticated;
