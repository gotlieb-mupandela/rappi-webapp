-- Categories required by full Joma catalog + NAD shipping rates.
insert into public.categories (slug, name, featured, blurb, sort_order) values
  ('sportswear', 'Sportswear', true, 'Tees, shorts, tracksuits, hoodies, jackets, and training layers.', 1),
  ('football', 'Football', true, 'Boots, sets, balls, socks, shin guards, and keeper gloves.', 2),
  ('basketball', 'Basketball', false, 'Shoes, jerseys, shorts, and match sets.', 3),
  ('netball', 'Netball', false, 'Dresses, skirts, and court shoes.', 4),
  ('swimming', 'Swimming', false, 'Swimwear, caps, and goggles.', 5),
  ('rugby', 'Rugby', false, 'Jerseys, shorts, balls, scrum caps, and protection.', 6),
  ('cricket', 'Cricket', false, 'Match whites and cricket clothing.', 7),
  ('boxing', 'Boxing', false, 'Boxing shorts from opening stock.', 8),
  ('hockey', 'Hockey', false, 'Hockey shorts from opening stock.', 9),
  ('running-fitness', 'Running & Fitness', true, 'Running tops, shorts, mats, and training towels.', 10),
  ('shoes', 'Shoes', true, 'Road, indoor, kids, and lifestyle trainers.', 11),
  ('balls-bags', 'Balls & Bags', false, 'Volleyballs, kit bags, and ball bags.', 12),
  ('brama', 'Brama', false, 'Base layers and compression from the Brama range.', 13),
  ('hiking', 'Hiking', false, 'Outdoor and trail apparel.', 14),
  ('lifestyle', 'Lifestyle', false, 'Casual and lifestyle pieces.', 15),
  ('padel', 'Padel', false, 'Padel rackets, shoes, and court wear.', 16),
  ('resort', 'Resort', false, 'Resort and leisure collection.', 17),
  ('teampro-2026', 'Teampro 2026', false, 'Teampro 2026 kit and apparel.', 18)
on conflict (slug) do update set
  name = excluded.name,
  featured = excluded.featured,
  blurb = excluded.blurb,
  sort_order = excluded.sort_order;

insert into public.shipping_methods (id, name, cost, sort_order) values
  ('standard', 'Standard (5–8 days)', 100, 1),
  ('express', 'Express (2–3 days)', 150, 2),
  ('pickup', 'Hub pickup', 0, 3)
on conflict (id) do update set name = excluded.name, cost = excluded.cost, sort_order = excluded.sort_order;
