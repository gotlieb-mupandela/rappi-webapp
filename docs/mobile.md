# Mobile: Play Store and App Store

The site is a regular Next.js web app. Store listings use a Capacitor shell in `mobile/` that loads `https://www.rappisportshub.com`.

## Push (native app)

### Env (Vercel + `.env.local`)

```
NEXT_PUBLIC_VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:sales@rappisportshub.com
PUSH_WEBHOOK_SECRET=
```

Generate keys if you still send to leftover web subscriptions: `npx web-push generate-vapid-keys --json`.

### Database

Apply `supabase/migrations/20261002180351_push_subscriptions.sql`:

```bash
supabase db push
```

### Database webhook

In Supabase Dashboard → Database → Webhooks:

- Table: `orders`
- Events: UPDATE
- URL: `https://www.rappisportshub.com/api/push/order-status`
- HTTP headers: `Authorization: Bearer <PUSH_WEBHOOK_SECRET>`

Customers opt in on `/account` inside the native app (`components/push-toggle.tsx`).

## Capacitor

`mobile/capacitor.config.ts` sets `server.url` to the production site so Supabase SSR, middleware, and API routes keep working.

```bash
cd mobile
npm install
npx cap sync
```

Plugins: App, Browser, Push Notifications, Splash Screen, Status Bar, Share, Haptics.

### Auth

Add this redirect URL in Supabase → Authentication → URL configuration:

- `com.rappisportshub.app://login-callback`

Google sign-in in the native shell opens the system browser and returns through `@capacitor/app` `appUrlOpen`.

Replace `TEAMID` in `public/.well-known/apple-app-site-association` with the Apple Team ID after the app exists in App Store Connect.

After Play App Signing is enabled, copy the SHA-256 fingerprint into `public/.well-known/assetlinks.json`.

## Cloud build

[`codemagic.yaml`](../codemagic.yaml) builds the iOS IPA and can upload to TestFlight.

1. Apple Developer Program ($99/year) and Play Console ($25 one-time).
2. Create the store listings for `com.rappisportshub.app`.
3. Connect this repo in Codemagic (or Ionic Appflow), add signing, and run `ios-capacitor`.
4. Android: `cd mobile && npx cap sync android`, then assemble a signed AAB in Android Studio or CI.

## Remaining human steps

- Deploy to Vercel and add the VAPID / webhook env vars
- `supabase db push` and create the orders webhook
- Play Console listing + AAB upload
- Paste the Play signing SHA-256 into `assetlinks.json`
- Apple Developer + Codemagic signing + TestFlight
