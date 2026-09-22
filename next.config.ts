import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Dev binds to 0.0.0.0; browsers hit 127.0.0.1 / localhost — allow HMR + assets.
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  images: {
    localPatterns: [{ pathname: "/brand/**" }, { pathname: "/**" }],
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
