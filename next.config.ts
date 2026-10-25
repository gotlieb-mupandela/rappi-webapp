import type { NextConfig } from "next";

// Report-only on purpose. Next inlines bootstrap scripts and style attributes,
// Google Identity Services loads accounts.google.com (script plus button frame),
// the Meta Pixel loads connect.facebook.net and www.facebook.com, product
// photos load from wsrv.nl and the next/image remote hosts, and the browser
// talks to the Supabase project for auth and storage. Vercel preview toolbar
// assets are included so a later enforce step does not blank previews.
// Checkout leaves via window.location to https://secure.3gdirectpay.com/payv3.php.
// This policy does not set navigate-to, so that top-level redirect is not
// blocked. DPO sends the shopper back with a top-level redirect to
// /checkout/return or /checkout/cancel. Nothing in the app frames this site,
// so X-Frame-Options DENY is not on that return path.
const contentSecurityPolicyReportOnly = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "script-src 'self' 'unsafe-inline' https://accounts.google.com https://connect.facebook.net https://vercel.live https://*.vercel-scripts.com",
  "style-src 'self' 'unsafe-inline' https://accounts.google.com https://vercel.live",
  "img-src 'self' data: https://wzmzwerzbyudcvoiiege.supabase.co https://wsrv.nl https://www.joma-sport.com https://v1.joma-sport.net https://www.facebook.com https://accounts.google.com https://assets.vercel.com",
  "font-src 'self' https://assets.vercel.com",
  "connect-src 'self' https://wzmzwerzbyudcvoiiege.supabase.co wss://wzmzwerzbyudcvoiiege.supabase.co https://accounts.google.com https://www.facebook.com https://connect.facebook.net https://secure.3gdirectpay.com https://vercel.live",
  "frame-src 'self' https://accounts.google.com https://secure.3gdirectpay.com https://vercel.live",
  "form-action 'self' https://secure.3gdirectpay.com",
  "worker-src 'self'",
  "manifest-src 'self'",
].join("; ");

const securityHeaders = [
  {
    key: "Content-Security-Policy-Report-Only",
    value: contentSecurityPolicyReportOnly,
  },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
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
        headers: securityHeaders,
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
