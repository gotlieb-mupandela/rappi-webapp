import type { NextConfig } from "next";
import { securityHeaders } from "./lib/security-headers";

// securityHeaders() (lib/security-headers.ts) sets the static headers here:
// X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy
// and HSTS. The Content-Security-Policy is NOT set here — it needs a fresh
// per-request nonce, so middleware.ts builds it (contentSecurityPolicy) and
// sends it, still as Content-Security-Policy-Report-Only, with report-uri
// pointing at /api/csp-report. See lib/content-security-policy.ts for the
// third-party hosts (Google Identity, Meta Pixel, Supabase, DPO checkout).

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Dev binds to 0.0.0.0; browsers hit 127.0.0.1 / localhost — allow HMR + assets.
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  images: {
    // Display optimized photos inline (Next 15+ default is attachment).
    contentDispositionType: "inline",
    // Cache optimized product thumbs for a day (remote Joma files are multi‑MB originals).
    minimumCacheTTL: 60 * 60 * 24,
    qualities: [70, 75, 80],
    localPatterns: [{ pathname: "/brand/**" }, { pathname: "/**" }],
    // wsrv.nl is the productImageLoader <img> src, not a next/image src.
    // Do not add it here: /_next/image would then fetch arbitrary URLs through that proxy.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "wzmzwerzbyudcvoiiege.supabase.co",
        pathname: "/storage/v1/object/public/product-images/**",
      },
      {
        protocol: "https",
        hostname: "www.joma-sport.com",
        pathname: "/on/demandware.static/**",
      },
      {
        protocol: "https",
        hostname: "v1.joma-sport.net",
        pathname: "/files/**",
      },
    ],
  },
  async redirects() {
    return [
      { source: "/account/profile", destination: "/account", permanent: true },
      { source: "/shop/teampro", destination: "/shop/teampro-2026", permanent: true },
      { source: "/category/teampro", destination: "/category/teampro-2026", permanent: true },
      { source: "/dpo-test", destination: "/product/DPO-TEST", permanent: false },
      { source: "/dpo-test/return", destination: "/checkout/return", permanent: false },
      { source: "/dpo-test/cancel", destination: "/checkout/cancel", permanent: false },
      { source: "/signup", destination: "/login?mode=signup", permanent: false },
      { source: "/register", destination: "/login?mode=signup", permanent: false },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders(),
      },
      {
        source: "/.well-known/apple-app-site-association",
        headers: [
          { key: "Content-Type", value: "application/json" },
          { key: "Cache-Control", value: "public, max-age=3600" },
        ],
      },
      {
        source: "/.well-known/assetlinks.json",
        headers: [{ key: "Cache-Control", value: "public, max-age=3600" }],
      },
      {
        source: "/listing-index.json",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=3600, stale-while-revalidate=86400",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
