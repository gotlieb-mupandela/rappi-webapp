import {
  CSP_REPORT_ONLY_HEADER,
  contentSecurityPolicyReportOnly,
  type ContentSecurityPolicyEnv,
} from "./content-security-policy";

export type SecurityHeader = { key: string; value: string };

/** Env names next.config.ts passes through. Values are not logged. */
export function securityHeaderEnv(env: NodeJS.ProcessEnv = process.env): ContentSecurityPolicyEnv {
  return {
    supabaseUrl: env.NEXT_PUBLIC_SUPABASE_URL,
    dpoPayUrl: env.DPO_PAY_URL,
  };
}

/**
 * Headers for every page. CSP stays on Content-Security-Policy-Report-Only.
 * next.config.ts headers() and the CSP test both call this function.
 */
export function securityHeaders(env: ContentSecurityPolicyEnv = securityHeaderEnv()): SecurityHeader[] {
  return [
    {
      key: CSP_REPORT_ONLY_HEADER,
      value: contentSecurityPolicyReportOnly(env),
    },
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
