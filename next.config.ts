import type { NextConfig } from "next";
import { securityHeaders } from "./lib/security-headers";

// Report-only on purpose. The header list is securityHeaders() in
// lib/security-headers.ts, shared with the CSP test. Next inlines bootstrap
// scripts and style attributes. Google Identity Services loads
// accounts.google.com (script plus button frame). The Meta Pixel loads
// connect.facebook.net. Product photos load from wsrv.nl plus the supplier
// and Supabase hosts in images.remotePatterns. The browser talks to
// NEXT_PUBLIC_SUPABASE_URL for auth, data, and storage. Checkout assigns
// window.location to DPO_PAY_URL (default
// https://secure.3gdirectpay.com/payv3.php). DPO_API_URL is called only from
// the server. navigate-to lists that pay host, the Supabase host,
// accounts.google.com, WhatsApp, and mailto. It is report-only, so a missing
// host is logged and not blocked. DPO sends the shopper back with a top-level
// redirect to /checkout/return or /checkout/cancel. Nothing in the app frames
// this site, so X-Frame-Options DENY is not on that return path.

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Dev binds to 0.0.0.0; browsers hit 127.0.0.1 / localhost — allow HMR + assets.
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  images: {
    // Cache optimized product thumbs for a day (remote Joma files are multi‑MB originals).
    minimumCacheTTL: 60 * 60 * 24,
    qualities: [70, 75, 80],
    localPatterns: [{ pathname: "/brand/**" }, { pathname: "/**" }],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "wsrv.nl",
        pathname: "/**",
      },
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
      { source: "/shop/teampro", destination: "/shop/teampro-2026", permanent: true },
      { source: "/category/teampro", destination: "/category/teampro-2026", permanent: true },
      { source: "/dpo-test", destination: "/product/DPO-TEST", permanent: false },
      { source: "/dpo-test/return", destination: "/checkout/return", permanent: false },
      { source: "/dpo-test/cancel", destination: "/checkout/cancel", permanent: false },
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
