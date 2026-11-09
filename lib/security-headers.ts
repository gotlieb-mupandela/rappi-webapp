import type { ContentSecurityPolicyEnv } from "./content-security-policy";

export type SecurityHeader = { key: string; value: string };

/** Env names next.config.ts and middleware.ts pass through. Values are not logged. */
export function securityHeaderEnv(env: NodeJS.ProcessEnv = process.env): ContentSecurityPolicyEnv {
  return {
    supabaseUrl: env.NEXT_PUBLIC_SUPABASE_URL,
    dpoPayUrl: env.DPO_PAY_URL,
  };
}

/**
 * Static headers for every page, set by next.config.ts headers().
 *
 * The Content-Security-Policy is NOT here: it needs a fresh per-request nonce,
 * so it is built in middleware.ts (contentSecurityPolicy) and sent — still as
 * Content-Security-Policy-Report-Only — on every response there.
 */
export function securityHeaders(): SecurityHeader[] {
  return [
    { key: "X-Frame-Options", value: "DENY" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    // The app does not use the camera, microphone, or geolocation.
    {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(), geolocation=()",
    },
    // includeSubDomains only after every rappisportshub.com subdomain is
    // confirmed https-only. preload is deliberately left out.
    {
      key: "Strict-Transport-Security",
      value: "max-age=31536000",
    },
  ];
}
