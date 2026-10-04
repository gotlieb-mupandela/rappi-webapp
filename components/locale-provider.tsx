"use client";

import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import {
  MARKET_COOKIE,
  MARKET_COOKIE_MAX_AGE,
  MARKET_META,
  MARKET_SOURCE_COOKIE,
  MARKET_SOURCE_STORAGE_KEY,
  MARKET_STORAGE_KEY,
  htmlLang,
  isMarket,
  isMarketSource,
  type Market,
  type MarketSource,
} from "@/lib/i18n/config";
import { detectMarketFromSignals } from "@/lib/i18n/detect";
import { formatMoney } from "@/lib/i18n/currency";
import { makeT, type TFunction } from "@/lib/i18n/translate";

type LocaleContextValue = {
  market: Market;
  setMarket: (market: Market, source?: MarketSource) => void;
  t: TFunction;
  format: (nad: number) => string;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

function writeCookie(name: string, value: string) {
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${MARKET_COOKIE_MAX_AGE}; SameSite=Lax`;
}

function applyMarketDom(market: Market) {
  const root = document.documentElement;
  root.lang = htmlLang(market);
  root.dataset.market = market;
}

export function persistMarket(market: Market, source: MarketSource) {
  applyMarketDom(market);
  writeCookie(MARKET_COOKIE, market);
  writeCookie(MARKET_SOURCE_COOKIE, source);
  try {
    localStorage.setItem(MARKET_STORAGE_KEY, market);
    localStorage.setItem(MARKET_SOURCE_STORAGE_KEY, source);
  } catch {
    /* ignore */
  }
}

function readCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function readStoredMarket(): { market: Market | null; source: MarketSource | null } {
  try {
    const market = localStorage.getItem(MARKET_STORAGE_KEY);
    const source = localStorage.getItem(MARKET_SOURCE_STORAGE_KEY);
    return {
      market: isMarket(market) ? market : null,
      source: isMarketSource(source) ? source : null,
    };
  } catch {
    return { market: null, source: null };
  }
}

export function LocaleProvider({
  children,
  initialMarket,
}: {
  children: ReactNode;
  initialMarket: Market;
}) {
  const router = useRouter();
  const [override, setOverride] = useState<Market | null>(null);
  const market = override ?? initialMarket;

  if (override && override === initialMarket) {
    setOverride(null);
  }

  useLayoutEffect(() => {
    const stored = readStoredMarket();
    const cookieMarket = readCookie(MARKET_COOKIE);
    const cookieSource = readCookie(MARKET_SOURCE_COOKIE);

    if (stored.source === "manual" && stored.market) {
      persistMarket(stored.market, "manual");
      if (stored.market !== initialMarket) setOverride(stored.market);
      return;
    }

    if (cookieSource === "manual" && isMarket(cookieMarket)) {
      persistMarket(cookieMarket, "manual");
      if (cookieMarket !== initialMarket) setOverride(cookieMarket);
      return;
    }

    if (isMarket(cookieMarket)) {
      persistMarket(cookieMarket, "auto");
      if (cookieMarket !== initialMarket) setOverride(cookieMarket);
      return;
    }

    let tz = "";
    try {
      tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    } catch {
      tz = "";
    }
    const detected = detectMarketFromSignals({
      acceptLanguage: navigator.language,
      timeZone: tz,
    });
    persistMarket(detected, "auto");
    if (detected !== initialMarket) setOverride(detected);
    // Cookie / timezone alignment after mount — no RSC refresh (layout is static).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setMarket = useCallback(
    (next: Market, nextSource: MarketSource = "manual") => {
      setOverride(next);
      persistMarket(next, nextSource);
      router.refresh();
    },
    [router],
  );

  const t = useMemo(() => makeT(market), [market]);
  const format = useCallback((nad: number) => formatMoney(nad, market), [market]);

  const value = useMemo(
    () => ({ market, setMarket, t, format }),
    [market, setMarket, t, format],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    throw new Error("useLocale must be used within LocaleProvider");
  }
  return ctx;
}

export function useT() {
  return useLocale().t;
}

export function useMoney() {
  const { format, market } = useLocale();
  return { format, market, currency: MARKET_META[market].currency };
}
