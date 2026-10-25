# Meta Commerce Manager + WhatsApp

The website catalog (Supabase) is the source of truth. Meta pulls a scheduled TSV feed. WhatsApp, Instagram, and Facebook shops should all use this same catalog. Product links in the feed point back to RAPPI product pages so checkout stays on the website.

## Environment

Set these in Vercel (and `.env.local` for local checks):

| Variable | Where |
| --- | --- |
| `META_CATALOG_FEED_TOKEN` | Server. Required to fetch the feed. |
| `NEXT_PUBLIC_META_PIXEL_ID` | Browser Pixel. |
| `META_CAPI_ACCESS_TOKEN` | Server Conversions API (Purchase). |
| `META_CATALOG_ID` | Optional reference only. |
| `NEXT_PUBLIC_SITE_URL` | Absolute product and image URLs (`https://www.rappisportshub.com`). |
| `SUPABASE_SERVICE_ROLE_KEY` | Live stock/price for the feed. Offline baked catalog is the fallback. |

Redeploy after adding env vars.

## 1. Product feed

1. In Meta Commerce Manager, create or open the RAPPI catalog.
2. Add a data source: **Scheduled feed**.
3. Feed URL:

   `https://www.rappisportshub.com/api/feeds/meta-catalog?token=YOUR_META_CATALOG_FEED_TOKEN`

4. Set the fetch schedule (hourly if available).
5. Currency in the file is **NAD**. Do not convert to EUR in the feed.
6. Variants are one row per size. `item_group_id` is the product code. `id` is `{code}_{size}`.

After admin price, stock, or product changes in Supabase, Meta picks them up on the next scheduled fetch (the feed is cached for about 15 minutes).

## 2. Pixel

1. Create a Meta Pixel in Events Manager.
2. Put the Pixel ID in `NEXT_PUBLIC_META_PIXEL_ID` and redeploy.

Tracked automatically:

- `PageView`
- `ViewContent` (product pages)
- `Search`
- `AddToCart`
- `InitiateCheckout`
- `Purchase` (browser + Conversions API, same `event_id` = payment id)

## 3. Conversions API

1. Create a System User in Meta Business Settings.
2. Grant the Pixel (and catalog if you add API sync later) to that user.
3. Generate a token with ads/events permission.
4. Set `META_CAPI_ACCESS_TOKEN`.

Purchase is sent from DPO fulfillment (return page and webhook). The browser Purchase uses the same event id so Meta can dedupe.

## 4. WhatsApp, Instagram, Facebook

1. In Commerce Manager, attach this catalog to **WhatsApp**, **Instagram Shopping**, and **Facebook Shops** where the account is eligible.
2. In WhatsApp Business Manager, connect the same catalog. Product messages should use the feed `link` (the RAPPI PDP). Do not enable WhatsApp-native checkout.
3. Confirm a sample SKU: name, NAD price, image, availability, and website URL.

## 5. Spot-check

```bash
curl -sS "https://www.rappisportshub.com/api/feeds/meta-catalog?token=YOUR_TOKEN" | head
```

Expect TSV columns starting with `id`, `item_group_id`, `title`, and prices like `899.00 NAD`.
