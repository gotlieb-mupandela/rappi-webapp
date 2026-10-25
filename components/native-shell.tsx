"use client";

import { useEffect } from "react";
import { NATIVE_SCHEME, isNativeApp, nativePlatform } from "@/lib/native";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";

async function hideSplash() {
  try {
    const { SplashScreen } = await import("@capacitor/splash-screen");
    await SplashScreen.hide();
  } catch {
    /* plugin missing in browser */
  }
}

async function styleStatusBar() {
  try {
    const { StatusBar, Style } = await import("@capacitor/status-bar");
    await StatusBar.setStyle({ style: Style.Light });
    if (nativePlatform() === "android") {
      await StatusBar.setBackgroundColor({ color: "#ffffff" });
    }
  } catch {
    /* plugin missing in browser */
  }
}

function callbackParams(url: string) {
  try {
    const parsed = new URL(url);
    return parsed.searchParams;
  } catch {
    return new URLSearchParams(url.split("?")[1] ?? "");
  }
}

export function NativeShell() {
  useEffect(() => {
    if (!isNativeApp()) return;

    void hideSplash();
    void styleStatusBar();

    let remove: (() => void) | undefined;
    void (async () => {
      try {
        const { App } = await import("@capacitor/app");
        const { Browser } = await import("@capacitor/browser");
        const onAuthUrl = async (url: string) => {
          if (!url.startsWith(`${NATIVE_SCHEME}://`)) return;
          try {
            await Browser.close();
          } catch {
            /* already closed */
          }
          if (!isSupabaseConfigured()) return;
          const params = callbackParams(url);
          const code = params.get("code");
          if (!code) return;
          const supabase = createClient();
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) console.error("native oauth", error.message);
        };
        const handle = await App.addListener("appUrlOpen", ({ url }) => {
          void onAuthUrl(url);
        });
        remove = () => {
          void handle.remove();
        };
        // Cold start: Android may have killed the app while the browser was open.
        const launch = await App.getLaunchUrl();
        if (launch?.url) await onAuthUrl(launch.url);
      } catch {
        /* Capacitor App plugin not in this runtime */
      }
    })();

    return () => remove?.();
  }, []);

  return null;
}
