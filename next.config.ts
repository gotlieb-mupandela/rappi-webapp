import type { NextConfig } from "next";

/**
 * Old public slugs on browser pages. Kept in its own list so other
 * redirect edits (signup and register) can merge without touching this block.
 * Destination query values override the matched param. Other query
 * params are copied through by Next (prepareDestination merge order).
 *
 * Query rules skip /api. The mobile app calls the catalog API with the
 * old slugs and caches that JSON, so those routes accept both slugs
 * instead of redirecting.
 */
const browserPath = "/:path((?!api(?:/|$)).*)";

const publicSlugRedirects: NonNullable<
  Awaited<ReturnType<NonNullable<NextConfig["redirects"]>>>
> = [
  {
    source: "/shop/joma-flow",
    destination: "/shop/shoes?group=flow",
    permanent: true,
  },
  {
    source: "/category/joma-flow",
    destination: "/shop/shoes?group=flow",
    permanent: true,
  },
  {
    source: browserPath,
    has: [{ type: "query", key: "tab", value: "joma-kids" }],
    destination: "/:path*?tab=kids",
    permanent: true,
  },
  {
    source: browserPath,
    has: [{ type: "query", key: "group", value: "joma-flow" }],
    destination: "/:path*?group=flow",
    permanent: true,
  },
  {
    source: browserPath,
    has: [{ type: "query", key: "sub", value: "joma-flow" }],
    destination: "/:path*?sub=flow",
    permanent: true,
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
      ...publicSlugRedirects,
    ];
  },
  async headers() {
    return [
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
