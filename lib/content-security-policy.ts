import { PRODUCT_IMAGE_PROXY_HOST } from "./product-image-loader";

/** Hosts allowed by next.config.ts images.remotePatterns. */
export const PRODUCT_IMAGE_REMOTE_HOSTS = [
  PRODUCT_IMAGE_PROXY_HOST,
  "wzmzwerzbyudcvoiiege.supabase.co",
  "www.joma-sport.com",
  "v1.joma-sport.net",
] as const;

const SUPABASE_HOST_FALLBACK = "wzmzwerzbyudcvoiiege.supabase.co";
const DPO_PAY_HOST_FALLBACK = "secure.3gdirectpay.com";

export const CSP_REPORT_ONLY_HEADER = "Content-Security-Policy-Report-Only";
export const CSP_ENFORCED_HEADER = "Content-Security-Policy";

/** Where the browser POSTs violation reports. Served by app/api/csp-report. */
export const CSP_REPORT_PATH = "/api/csp-report";

/**
 * Enforcement is a single runtime switch, not a code change: set the env var
 * CSP_ENFORCE=true (e.g. on Vercel) and the policy is sent as the enforcing
 * Content-Security-Policy header; unset or anything else keeps it on
 * Content-Security-Policy-Report-Only. This makes turning the net on — and
 * rolling it straight back — a one-variable flip with no redeploy of code.
 */
type EnvLike = Record<string, string | undefined>;

export function cspEnforced(env: EnvLike = process.env) {
  return env.CSP_ENFORCE === "true";
}

/** The response header name to use for the CSP, per the CSP_ENFORCE switch. */
export function cspHeaderName(env: EnvLike = process.env) {
  return cspEnforced(env) ? CSP_ENFORCED_HEADER : CSP_REPORT_ONLY_HEADER;
}

export type ContentSecurityPolicyEnv = {
  /** NEXT_PUBLIC_SUPABASE_URL. Host only. The value is not logged. */
  supabaseUrl?: string;
  /** DPO_PAY_URL. Browser checkout redirect. DPO_API_URL stays server-side. */
  dpoPayUrl?: string;
};

function httpsHost(value: string | undefined, fallback: string) {
  const raw = value?.trim();
  if (!raw) return fallback;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:") return fallback;
    return url.host;
  } catch {
    return fallback;
  }
}

function httpsOrigin(host: string) {
  return host ? `https://${host}` : "";
}

function unique(sources: Array<string | undefined>) {
  return [...new Set(sources.filter((source): source is string => Boolean(source)))];
}

/**
 * Explicit script hosts kept for browsers that do not support
 * 'strict-dynamic' (CSP level 1/2). On level-3 browsers 'strict-dynamic'
 * makes these — and 'unsafe-inline' — ignored, so trust flows only from the
 * per-request nonce and scripts it loads.
 */
const SCRIPT_FALLBACK_HOSTS =
  "https://accounts.google.com https://connect.facebook.net https://vercel.live https://*.vercel-scripts.com";

/**
 * Content-Security-Policy string.
 *
 * Pass a per-request `nonce` (from middleware) to get the hardened
 * `script-src` with `'nonce-…' 'strict-dynamic'`. Call without a nonce only
 * where one cannot be generated per request (e.g. a static header); that
 * variant keeps the looser `'unsafe-inline'` script-src.
 *
 * img-src is only 'self', data:, and the product image hosts (wsrv.nl, the
 * Supabase product-images host, and the two supplier hosts). Checkout assigns
 * window.location to DPO_PAY_URL. `report-uri` points at CSP_REPORT_PATH so
 * violations are collected while the header stays Report-Only.
 */
export function contentSecurityPolicy(env: ContentSecurityPolicyEnv = {}, nonce?: string) {
  const supabaseHost = httpsHost(env.supabaseUrl, SUPABASE_HOST_FALLBACK);
  const dpoPayHost = httpsHost(env.dpoPayUrl, DPO_PAY_HOST_FALLBACK);
  const imageHosts = unique(PRODUCT_IMAGE_REMOTE_HOSTS.map((host) => httpsOrigin(host)));

  const scriptSrc = nonce
    ? `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https: 'unsafe-inline' ${SCRIPT_FALLBACK_HOSTS}`
    : `script-src 'self' 'unsafe-inline' ${SCRIPT_FALLBACK_HOSTS}`;

  const directives = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline' https://accounts.google.com https://vercel.live",
    `img-src 'self' data: ${imageHosts.join(" ")}`,
    "font-src 'self' https://assets.vercel.com",
    `connect-src 'self' ${httpsOrigin(supabaseHost)} wss://${supabaseHost} https://accounts.google.com https://www.facebook.com https://connect.facebook.net ${httpsOrigin(dpoPayHost)} https://vercel.live`,
    `frame-src 'self' https://accounts.google.com ${httpsOrigin(dpoPayHost)} https://vercel.live`,
    `form-action 'self' ${httpsOrigin(dpoPayHost)}`,
    "worker-src 'self'",
    "manifest-src 'self'",
    `report-uri ${CSP_REPORT_PATH}`,
  ];

  return directives.join("; ");
}

/**
 * Backwards-compatible alias. No nonce, so it emits the looser script-src.
 * The live header is built per request in middleware via contentSecurityPolicy.
 */
export function contentSecurityPolicyReportOnly(env: ContentSecurityPolicyEnv = {}) {
  return contentSecurityPolicy(env);
}
