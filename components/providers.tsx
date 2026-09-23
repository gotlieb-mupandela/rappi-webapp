"use client";

import { useEffect, type ReactNode } from "react";
import { Toaster } from "sonner";
import { LocaleProvider } from "@/components/locale-provider";
import type { Market } from "@/lib/i18n/config";
import { userFromAuth } from "@/lib/auth/session";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { useAuth } from "@/lib/stores/auth";
import { useCart } from "@/lib/stores/cart";
import { useOrders } from "@/lib/stores/orders";
import { useWishlist } from "@/lib/stores/wishlist";

export function Providers({
  children,
  initialMarket,
}: {
  children: ReactNode;
  initialMarket: Market;
}) {
  const setUser = useAuth((s) => s.setUser);
  const syncFromSupabase = useAuth((s) => s.syncFromSupabase);

  useEffect(() => {
    useCart.persist.rehydrate();
    useAuth.persist.rehydrate();
    useOrders.persist.rehydrate();
    useWishlist.persist.rehydrate();
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    void syncFromSupabase();
    const supabase = createClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        setUser(userFromAuth(session.user));
        if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED") {
          void syncFromSupabase();
        }
        return;
      }
      if (event === "SIGNED_OUT") {
        setUser(null);
      }
    });
    return () => subscription.unsubscribe();
  }, [setUser, syncFromSupabase]);

  return (
    <LocaleProvider initialMarket={initialMarket}>
      {children}
      <Toaster
        theme="light"
        position="bottom-right"
        offset={24}
        toastOptions={{
          style: {
            background: "var(--toast-bg)",
            border: "1px solid var(--toast-border)",
            color: "var(--toast-fg)",
            borderRadius: "12px",
            boxShadow: "var(--shadow-soft)",
          },
        }}
      />
    </LocaleProvider>
  );
}
