# CSP Hardening Plan — move from Report-Only `'unsafe-inline'` to enforced nonce-based

**Goal:** Turn the Content-Security-Policy from a telemetry-only header into a real
runtime XSS mitigation, by (1) enforcing it and (2) removing `'unsafe-inline'` from
`script-src` via per-request nonces.

**Current state (verified in repo):**
- Policy is built in `lib/content-security-policy.ts` → `contentSecurityPolicyReportOnly()`.
- Emitted in `lib/security-headers.ts` under the header `Content-Security-Policy-Report-Only`.
- Applied **statically** via `next.config.ts` → `headers()` (same value for every response).
- `script-src` and `style-src` both include `'unsafe-inline'`.
- No `report-uri` / `report-to` collector is configured.
- A test pins the current output: `lib/content-security-policy.test.ts`.

**The core blocker:** `next.config.ts` `headers()` runs at build/config time and
produces one constant header. A nonce must be unique per request, so nonce-based CSP
**must be emitted from middleware** (`middleware.ts` already exists and runs per-request).
Next.js then auto-propagates that nonce to the framework's own inline bootstrap/hydration
scripts when it finds a `nonce-...` in the request's CSP header.

---

## Scope decision: script-src yes, style-src no (for now)

- **`script-src`** — remove `'unsafe-inline'`, replace with `'nonce-<random>'` + `'strict-dynamic'`.
  This is where XSS actually executes, so it is the high-value change.
- **`style-src`** — **keep `'unsafe-inline'`.** Removing it is disproportionately painful:
  Tailwind/Next inject inline `style="..."` *attributes*, which nonces and hashes cannot
  cover at all (CSP nonces apply only to `<style>`/`<script>` elements, not attributes).
  Style injection is also a much lower-severity sink than script injection. Revisit only
  if you later eliminate all inline style attributes.

Net target `script-src`:
```
script-src 'self' 'nonce-<REQUEST_NONCE>' 'strict-dynamic' https: 'unsafe-inline'
```
Note: `'strict-dynamic'` makes modern browsers **ignore** host-allowlist entries and the
trailing `'unsafe-inline'`, trusting only nonced scripts + scripts they load. The explicit
hosts (`accounts.google.com`, `connect.facebook.net`, `vercel.live`, `*.vercel-scripts.com`)
and `'unsafe-inline'` are kept **only** as a fallback for legacy browsers that don't support
`'strict-dynamic'`. This is the standard Google/Next.js recommended shape.

---

## Phase 0 — Add a reporting endpoint first (do this before enforcing)

Enforcing blind risks breaking Google sign-in, DPO checkout redirect, or Vercel Live.
Add a collector so you can watch violations while still in Report-Only.

1. Create `app/api/csp-report/route.ts` — a `POST` handler that reads the JSON body and
   `console.warn`s (or forwards to your logging). Keep it unauthenticated but rate-limited
   with the existing `consumeRateLimit` helper; it only receives violation reports.
2. Add to the policy: `report-uri /api/csp-report` and
   `report-to csp-endpoint` (+ a `Report-To` header). `report-uri` is deprecated but still
   the most widely supported; include both.
3. Deploy, leave in Report-Only for a few days, and confirm the only violations are expected
   (or none). Pay attention to Google Identity Services (`gsi/client`) and DPO.

## Phase 1 — Move CSP emission into middleware (still Report-Only)

1. In `lib/content-security-policy.ts`, add a variant that takes a `nonce` argument and
   emits the `script-src` shape above. Keep `contentSecurityPolicyReportOnly()` for the test
   or update the test to the new output.
2. In `middleware.ts`:
   - Generate a nonce per request: `const nonce = crypto.randomUUID()` (or base64 of 16
     random bytes). The Edge runtime has Web Crypto.
   - Build the CSP string with that nonce.
   - Set the nonce on the **request** headers so Next can read it:
     `requestHeaders.set('x-nonce', nonce)` and pass
     `NextResponse.next({ request: { headers: requestHeaders } })`.
   - Set the CSP header on the **response** (still as `Content-Security-Policy-Report-Only`
     for this phase).
   - Important: the current `middleware.ts` early-returns `NextResponse.next()` for all
     non-`/admin` routes, and `updateSession()` builds its own responses. The CSP header +
     nonce request-header must be attached on **every** branch (storefront, admin-login,
     admin redirect, and the `updateSession` pass-through). Centralize it so no return path
     is missed.
   - Remove the CSP entry from `next.config.ts` `headers()` so it isn't set twice. Keep the
     other static headers (X-Frame-Options, HSTS, etc.) there, or move them all into
     middleware for one source of truth.
   - Widen the middleware `matcher` — it is currently only `/admin`, `/shop`, `/category`.
     CSP must cover **all** HTML responses, so add a catch-all that still excludes static
     assets, e.g. `'/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|svg|ico|webp)).*)'`.
3. Make inline scripts you control carry the nonce. Read it in a server component via
   `import { headers } from 'next/headers'; const nonce = (await headers()).get('x-nonce')`
   and pass `nonce={nonce}` to any `<script>` / `next/script` you render yourself
   (including the Google Identity Services loader). Next adds the nonce to its own bootstrap
   scripts automatically once the request CSP header contains a nonce.

## Phase 2 — Flip to enforced

1. Change the header name from `Content-Security-Policy-Report-Only` to
   `Content-Security-Policy` (keep `report-uri` so you still get violations).
2. Smoke-test the critical third-party flows in a real browser with devtools console open:
   - **Google sign-in** (GSI inline + `accounts.google.com`).
   - **DPO checkout** — `form-action`/`frame-src`/`connect-src` to the DPO pay host, and the
     `window.location` redirect to `DPO_PAY_URL`.
   - **Facebook pixel** (`connect.facebook.net`, `www.facebook.com`) if used.
   - **Vercel Live** preview comments (dev/preview only).
   - Service worker / push (`worker-src`, `manifest-src`).
3. Watch the report endpoint for a day post-enforcement; fix any directive gaps.

## Phase 3 — Tighten `connect-src` to the native app

The Capacitor app loads the site in a webview; confirm the custom scheme
`com.rappisportshub.app://` and any native bridges don't need `connect-src`/`frame-src`
additions. Test the signed-in app flows against the enforced policy before shipping to stores.

---

## Files to touch

| File | Change |
|---|---|
| `middleware.ts` | Generate nonce, set `x-nonce` request header, attach CSP on every return path, widen `matcher` |
| `lib/content-security-policy.ts` | Add nonce-aware builder; `script-src` with `'nonce-'` + `'strict-dynamic'`; add `report-uri`/`report-to` |
| `lib/security-headers.ts` | Swap header name to enforced in Phase 2; decide whether headers live here or in middleware |
| `next.config.ts` | Remove the CSP entry from `headers()` (avoid double-emit) |
| `app/api/csp-report/route.ts` | New: violation collector (rate-limited) |
| `lib/content-security-policy.test.ts` | Update expected output for the new directives |
| Components rendering inline `<script>` / GSI loader | Thread `nonce` from `headers()` |

## Rollback

Each phase is independently revertable. The safest rollback is renaming the header back to
`Content-Security-Policy-Report-Only` — the policy stops blocking instantly without a code
revert. Keep that one-line toggle easy to flip.

## Risk / effort

- **Effort:** ~0.5–1 day including third-party flow testing.
- **Main risk:** a missed middleware return path serving pages without the nonce → Next's
  bootstrap scripts get blocked and the page goes blank. The Report-Only phases exist
  specifically to catch this before it is enforced.
- **Residual after this plan:** `style-src 'unsafe-inline'` remains (accepted, low severity).
