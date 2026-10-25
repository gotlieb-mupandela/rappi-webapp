const fs = require("fs");

const products = JSON.parse(fs.readFileSync("data/products.json", "utf8"));

function lit(v) {
  if (v === null || v === undefined) return "null";
  return "'" + String(v).replace(/'/g, "''") + "'";
}

function arr(values) {
  if (!values.length) return "'{}'";
  return "ARRAY[" + values.map(lit).join(", ") + "]";
}

const categories = [
  ["sportswear", "Sportswear", true, "Tees, shorts, tracksuits, hoodies, jackets, and training layers.", 1],
  ["football", "Football", true, "Boots, sets, balls, socks, shin guards, and keeper gloves.", 2],
  ["basketball", "Basketball", false, "Shoes, jerseys, shorts, and match sets.", 3],
  ["netball", "Netball", false, "Dresses, skirts, and court shoes.", 4],
  ["swimming", "Swimming", false, "Swimwear, caps, and goggles.", 5],
  ["rugby", "Rugby", false, "Jerseys, shorts, balls, scrum caps, and protection.", 6],
  ["cricket", "Cricket", false, "Match whites and cricket clothing.", 7],
  ["boxing", "Boxing", false, "Boxing shorts from opening stock.", 8],
  ["hockey", "Hockey", false, "Hockey shorts from opening stock.", 9],
  ["running-fitness", "Running & Fitness", true, "Running tops, shorts, mats, and training towels.", 10],
  ["shoes", "Shoes", true, "Road, indoor, kids, and lifestyle trainers.", 11],
  ["balls-bags", "Balls & Bags", false, "Volleyballs, kit bags, and ball bags.", 12],
  ["brama", "Brama", false, "Base layers and compression from the Brama range.", 13],
  ["hiking", "Hiking", false, "Outdoor and trail apparel.", 14],
  ["lifestyle", "Lifestyle", false, "Casual and lifestyle pieces.", 15],
  ["padel", "Padel", false, "Padel rackets, shoes, and court wear.", 16],
  ["resort", "Resort", false, "Resort and leisure collection.", 17],
  ["teampro-2026", "Teampro 2026", false, "Teampro 2026 kit and apparel.", 18],
];

const sql = [];
sql.push("-- Seed catalog and demo shop user");
sql.push("insert into public.categories (slug, name, featured, blurb, sort_order) values");
sql.push(
  categories
    .map(
      ([slug, name, featured, blurb, sort]) =>
        "  (" + [lit(slug), lit(name), featured, lit(blurb), sort].join(", ") + ")",
    )
    .join(",\n") +
    "\non conflict (slug) do update set name = excluded.name, featured = excluded.featured, blurb = excluded.blurb, sort_order = excluded.sort_order;",
);

sql.push("");
sql.push("insert into public.shipping_methods (id, name, cost, sort_order) values");
sql.push(
  [
    "  ('standard', 'Standard (5–8 days)', 100, 1)",
    "  ('express', 'Express (2–3 days)', 150, 2)",
    "  ('pickup', 'Hub pickup', 0, 3)",
  ].join(",\n") +
    "\non conflict (id) do update set name = excluded.name, cost = excluded.cost, sort_order = excluded.sort_order;",
);

sql.push("");
sql.push(
  "insert into public.products (id, code, item, title, name, display_name, category_slug, subcategory, gender, price, unit_price, currency, sheet_category, badge, image_url, images) values",
);
sql.push(
  products
    .map((p) => {
      const badge = p.badge ? lit(p.badge) + "::public.product_badge" : "null";
      return (
        "  (" +
        [
          lit(p.id),
          lit(p.code),
          lit(p.item),
          lit(p.title),
          lit(p.name),
          lit(p.displayName),
          lit(p.category),
          lit(p.subcategory),
          lit(p.gender) + "::public.gender",
          p.price,
          p.unitPrice,
          lit(p.currency),
          lit(p.sheetCategory),
          badge,
          lit(p.imageUrl),
          arr(p.images),
        ].join(", ") +
        ")"
      );
    })
    .join(",\n") +
    "\non conflict (id) do update set code = excluded.code, item = excluded.item, title = excluded.title, name = excluded.name, display_name = excluded.display_name, category_slug = excluded.category_slug, subcategory = excluded.subcategory, gender = excluded.gender, price = excluded.price, unit_price = excluded.unit_price, currency = excluded.currency, sheet_category = excluded.sheet_category, badge = excluded.badge, image_url = excluded.image_url, images = excluded.images;",
);

const sizes = [];
for (const p of products) {
  for (const s of p.sizes) {
    sizes.push("  (" + [lit(p.id), lit(s.size), s.stock].join(", ") + ")");
  }
}

sql.push("");
sql.push("insert into public.product_sizes (product_id, size, stock) values");
sql.push(
  sizes.join(",\n") +
    "\non conflict (product_id, size) do update set stock = excluded.stock;",
);

sql.push("");
sql.push(`do $$
declare
  uid uuid := '11111111-1111-4111-8111-111111111111';
begin
  if not exists (select 1 from auth.users where email = 'shop@rappi.com') then
    insert into auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      email_change,
      email_change_token_new,
      recovery_token,
      is_sso_user,
      is_anonymous
    ) values (
      '00000000-0000-0000-0000-000000000000',
      uid,
      'authenticated',
      'authenticated',
      'shop@rappi.com',
      extensions.crypt('rappi123', extensions.gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"RAPPI Shop","name":"RAPPI Shop"}'::jsonb,
      now(),
      now(),
      '',
      '',
      '',
      '',
      false,
      false
    );

    insert into auth.identities (
      user_id,
      provider_id,
      identity_data,
      provider,
      last_sign_in_at,
      created_at,
      updated_at
    ) values (
      uid,
      uid::text,
      jsonb_build_object('sub', uid::text, 'email', 'shop@rappi.com', 'email_verified', true),
      'email',
      now(),
      now(),
      now()
    );
  end if;
end $$;`);

const out = "supabase/migrations/20260907100001_seed_catalog.sql";
fs.writeFileSync(out, sql.join("\n") + "\n");
console.log({ products: products.length, sizes: sizes.length, bytes: fs.statSync(out).size });
