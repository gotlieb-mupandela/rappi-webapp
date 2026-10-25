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

export type ContentSecurityPolicyEnv = {
  /** NEXT_PUBLIC_SUPABASE_URL. Host only. The value is not logged. */
  supabaseUrl?: string;
  /** DPO_PAY_URL. Browser checkout redirect. DPO_API_URL stays server-side. */
  dpoPayUrl?: string;
  /** NEXT_PUBLIC_INSTAGRAM_URL. Included on navigate-to only when set. */
  instagramUrl?: string;
  /** NEXT_PUBLIC_FACEBOOK_URL. Included on navigate-to only when set. */
  facebookUrl?: string;
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
 * Report-only policy. Product photos are requested from wsrv.nl (the loader)
 * and, on raw img tags, from the supplier hosts and Supabase storage.
 * Checkout assigns window.location to DPO_PAY_URL. Google sign-in can leave
 * for the Supabase auth host and accounts.google.com. WhatsApp and mailto
 * links are real navigations too.
 */
export function contentSecurityPolicyReportOnly(env: ContentSecurityPolicyEnv = {}) {
  const supabaseHost = httpsHost(env.supabaseUrl, SUPABASE_HOST_FALLBACK);
  const dpoPayHost = httpsHost(env.dpoPayUrl, DPO_PAY_HOST_FALLBACK);
  const imageHosts = unique([
    ...PRODUCT_IMAGE_REMOTE_HOSTS.map((host) => httpsOrigin(host)),
    httpsOrigin(supabaseHost),
  ]);
  const socialNav = unique([
    httpsOrigin(httpsHost(env.instagramUrl, "")),
    httpsOrigin(httpsHost(env.facebookUrl, "")),
  ]);

  const directives = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "script-src 'self' 'unsafe-inline' https://accounts.google.com https://connect.facebook.net https://vercel.live https://*.vercel-scripts.com",
    "style-src 'self' 'unsafe-inline' https://accounts.google.com https://vercel.live",
    `img-src 'self' data: ${imageHosts.join(" ")} https://www.facebook.com https://accounts.google.com https://assets.vercel.com`,
    "font-src 'self' https://assets.vercel.com",
    `connect-src 'self' ${httpsOrigin(supabaseHost)} wss://${supabaseHost} https://accounts.google.com https://www.facebook.com https://connect.facebook.net ${httpsOrigin(dpoPayHost)} https://vercel.live`,
    `frame-src 'self' https://accounts.google.com ${httpsOrigin(dpoPayHost)} https://vercel.live`,
    `form-action 'self' ${httpsOrigin(dpoPayHost)}`,
    `navigate-to 'self' ${httpsOrigin(dpoPayHost)} ${httpsOrigin(supabaseHost)} https://accounts.google.com https://wa.me mailto: ${socialNav.join(" ")}`.trim(),
    "worker-src 'self'",
    "manifest-src 'self'",
  ];

  return directives.join("; ");
}
