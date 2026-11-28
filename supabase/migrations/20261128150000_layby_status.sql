-- Online layby: an order on layby exists from the deposit (stock reserved) until fully paid.
alter type public.order_status add value if not exists 'layby' before 'reserved';
