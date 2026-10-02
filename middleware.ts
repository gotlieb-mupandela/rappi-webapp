import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import {
  MARKET_COOKIE,
  MARKET_COOKIE_OPTIONS,
  MARKET_SOURCE_COOKIE,
  isMarket,
} from "@/lib/i18n/config";
import { detectMarketFromSignals } from "@/lib/i18n/detect";

function attachMarketCookie(request: NextRequest, response: NextResponse) {
  const existing = request.cookies.get(MARKET_COOKIE)?.value;
  const source = request.cookies.get(MARKET_SOURCE_COOKIE)?.value;
  if (isMarket(existing)) return response;

  const market = detectMarketFromSignals({
    acceptLanguage: request.headers.get("accept-language"),
    country: request.headers.get("x-vercel-ip-country"),
  });
  response.cookies.set(MARKET_COOKIE, market, MARKET_COOKIE_OPTIONS);
  if (source !== "manual") {
    response.cookies.set(MARKET_SOURCE_COOKIE, "auto", MARKET_COOKIE_OPTIONS);
  }
  return response;
}

export async function middleware(request: NextRequest) {
  const response = await updateSession(request);
  return attachMarketCookie(request, response);
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/((?!_next/static|_next/image|favicon.ico|brand|products|listing-index\\.json|\\.well-known|.*\\.(?:svg|png|jpg|jpeg|gif|webp|json)$).*)",
  ],
};
