# RAPPI SPORTS HUB

Consumer sports catalog for **RAPPI SPORTS HUB**. Tagline: **EQUIP | PERFORM | INSPIRE**.

Dark storefront with neon lime CTAs. Opening-shop stock — **184 SKUs**. Unit prices are retail Namibian dollars (**N$**). France / EU visitors can switch the storefront to **French + euros** (converted from NAD). Guest browse and cart are enabled. Checkout charges via DPO after sign-in.

When `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set, the storefront reads catalog, shipping, and site settings from Supabase (with `/data/products.json` as offline fallback). Checkout charges via DPO after sign-in.

Staff use the **admin panel** at `/admin` (same Supabase project as the Expo app). Do not put a native admin in mobile.

This is not a Joma brand clone. Layout and page density follow a professional B2B catalog pattern; branding, copy, and imagery are RAPPI.

## Run locally

```bash
cp .env.example .env.local   # fill Supabase URL + anon key
npm install
npm run dev
```

Open [http://127.0.0.1:43123](http://127.0.0.1:43123).

Production build:

```bash
npm run build
npm start
```

## Storefront login

With Supabase configured, use **Google**, **Create account**, or email/password on `/login`.
Checkout requires a signed-in account (guest browse is still allowed).

### Google sign-in setup

1. Supabase Dashboard → Authentication → Providers → enable **Google** (Client ID + Secret from Google Cloud).
2. Add redirect URLs to the allow list:
   - `https://rappisportshub.com/auth/callback`
   - `http://127.0.0.1:43123/auth/callback`
3. In Google Cloud OAuth client, set Authorized redirect URI to:
   `https://wzmzwerzbyudcvoiiege.supabase.co/auth/v1/callback`

Paid orders are stored in Supabase after DPO confirms the charged amount. Account → Orders reads those rows.

DPO company notify URL (after `DPO_WEBHOOK_SECRET` is on Vercel):

`https://www.rappisportshub.com/api/payments/dpo/webhook?token=<DPO_WEBHOOK_SECRET>`

Copy the token from `.env.local`. The return page still creates the order if the shopper comes back signed in.

## Admin panel

1. Create a staff Auth user in Supabase.
2. Promote: `select public.promote_admin('staff@example.com');` (SQL editor / service role). Matches `auth.users.email`, not the profile email.
3. Sign in at `/admin/login`.

Routes: dashboard, products, orders, customers, content (`site_settings`), shipping. Never ship the service role key to the browser.

Schema source of truth: `supabase/migrations/` (shared with mobile).

## Catalog

Source rows: `/data/products-source.json`  
Normalized catalog: `/data/products.json` (offline fallback)

Integrity checks (184 unique SKUs, NAD currency, spot-check prices, 4–5 photos each):

```bash
npm run check:catalog
```

Regenerate from the sheet JSON:

```bash
npm run catalog
```

Product photos live at `public/products/{safeCode}/01…05.webp` and in Storage bucket `product-images`. Cards use photo 01; the PDP gallery uses the full set.

Search by product **CODE**, title, or category from the header or `/search`.

## Mobile (Play, App Store)

Capacitor shells for Google Play and the App Store. Setup and submit steps: [docs/mobile.md](docs/mobile.md).

## Meta Commerce

Scheduled product feed, Pixel, and Conversions API live in the app. Setup checklist: [docs/meta-commerce.md](docs/meta-commerce.md).

Feed URL (after `META_CATALOG_FEED_TOKEN` is set):

`https://www.rappisportshub.com/api/feeds/meta-catalog?token=…`

## Locale & currency

The storefront serves two markets from the same NAD catalog:

| Market | UI | Prices | When it is chosen |
| --- | --- | --- | --- |
| Namibia (default) | English | **N$** (whole dollars) | Unsure, `NA` geo, or English-first `Accept-Language` |
| France / EU | French | **€** (2 decimals) | `FR` / EU geo (`x-vercel-ip-country`), French `Accept-Language`, or Europe timezone |

**Manual override:** header switcher **EN · N$** ↔ **FR · €**. Choice is stored in the `rappi-market` cookie and `localStorage` (`rappi-market`) with source `manual`, and wins over auto-detect.

**Conversion:** catalog and checkout payloads stay in NAD. EUR is display-only:

```
EUR = round(NAD × NEXT_PUBLIC_EUR_PER_NAD, 2 cents)
```

- Env: `NEXT_PUBLIC_EUR_PER_NAD` (alias `NEXT_PUBLIC_NAD_TO_EUR`)
- Default rate: **0.05** (illustrative fixed rate: **N$20 = €1**, not a live FX feed). Update the env var when you want a new display rate.
- Rounding: NAD stays whole dollars; EUR uses 2 decimal places.
- Shipping: Standard **N$100** / Express **N$150** / hub pickup free — shown as €5.00 / €7.50 / Offert at the default rate.

Product names and descriptions stay in the source catalog language for v1.

## Routes

| Path | Screen |
| --- | --- |
| `/` | Catalog home |
| `/login` | Demo login + guest |
| `/category/[slug]` | Category hub |
| `/shop/[slug]` | Dense product listing + filters |
| `/product/[...code]` | Product detail (sizes, stock, low-stock &lt; 5) |
| `/search` | Search + filters |
| `/cart` | Cart with size/qty |
| `/checkout` | Shipping + `place_order` |
| `/checkout/confirmation` | Order confirmation |
| `/account` | Account home |
| `/account/orders` | Order history |
| `/account/profile` | Profile |
| `/promotions` | Promotions |
| `/teamwear` | Teamwear quote form |
| `/store` | Find our store / pickup / contact |
| `/admin` | Staff back office |

Top nav branches with stock: Sportswear, Football, Basketball, Netball, Swimming, Rugby, Cricket, Boxing, Hockey, Running & Fitness, Shoes, Balls & Bags.

## Stack

Next.js App Router, TypeScript, Tailwind CSS v4, shadcn-style UI primitives, Zustand (cart / auth / orders), Supabase (`@supabase/ssr`).
