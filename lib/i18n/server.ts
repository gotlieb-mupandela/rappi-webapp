/**
 * Request market from the storefront cookie, then Accept-Language / geo headers.
 * LocaleProvider mirrors the same cookie on the client so RSC and CSR stay aligned.
 */
import { cookies, headers } from "next/headers";
import {
  DEFAULT_MARKET,
  MARKET_COOKIE,
  isMarket,
  type Market,
} from "@/lib/i18n/config";
import { detectMarketFromSignals } from "@/lib/i18n/detect";
import { makeT } from "@/lib/i18n/translate";

export async function getMarket(): Promise<Market> {
  try {
    const jar = await cookies();
    const fromCookie = jar.get(MARKET_COOKIE)?.value;
    if (isMarket(fromCookie)) return fromCookie;
    const h = await headers();
    return detectMarketFromSignals({
      acceptLanguage: h.get("accept-language"),
      country: h.get("x-vercel-ip-country"),
    });
  } catch {
    return DEFAULT_MARKET;
  }
}

export async function getT() {
  return makeT(await getMarket());
}

export async function getMarketOrDefault(): Promise<Market> {
  try {
    return await getMarket();
  } catch {
    return DEFAULT_MARKET;
  }
}
