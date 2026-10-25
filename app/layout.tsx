import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Inter, Oswald } from "next/font/google";
import Script from "next/script";
import { MetaPixel } from "@/components/meta-pixel";
import { Providers } from "@/components/providers";
import { StorefrontChrome } from "@/components/storefront-chrome";
import { TAGLINE } from "@/lib/catalog";
import { DEFAULT_MARKET, MARKET_BOOTSTRAP, htmlLang } from "@/lib/i18n/config";
import type { StorefrontTaxonomy } from "@/lib/listing-types";
import storefrontNav from "@/data/storefront-nav.json";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "600", "700"],
  adjustFontFallback: false,
});

const oswald = Oswald({
  variable: "--font-oswald",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  display: "swap",
});

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover" as const,
};

const description =
  "RAPPI SPORTS HUB — consumer sports catalog. Gear up. Show up. Level up.";

export const metadata: Metadata = {
  title: {
    default: `RAPPI SPORTS HUB · ${TAGLINE}`,
    template: "%s · RAPPI SPORTS HUB",
  },
  description,
  applicationName: "RAPPI SPORTS HUB",
  formatDetection: { telephone: false },
  openGraph: {
    title: "RAPPI SPORTS HUB",
    description: TAGLINE,
    siteName: "RAPPI SPORTS HUB",
  },
};

const nav = storefrontNav as {
  taxonomy: StorefrontTaxonomy;
  categoryCounts: Record<string, number>;
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang={htmlLang(DEFAULT_MARKET)}
      data-market={DEFAULT_MARKET}
      suppressHydrationWarning
      className={`${inter.variable} ${oswald.variable} h-full antialiased`}
    >
      <body
        className={`${inter.className} flex min-h-full flex-col bg-bg text-ink`}
        suppressHydrationWarning
      >
        <Script id="rappi-market" strategy="beforeInteractive">
          {MARKET_BOOTSTRAP}
        </Script>
        <MetaPixel />
        <div className="relative z-10 flex min-h-full flex-1 flex-col">
          <Providers initialMarket={DEFAULT_MARKET}>
            <StorefrontChrome
              taxonomy={nav.taxonomy}
              categoryCounts={nav.categoryCounts}
            >
              {children}
            </StorefrontChrome>
          </Providers>
        </div>
      </body>
    </html>
  );
}
