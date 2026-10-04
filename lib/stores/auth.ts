"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User } from "@/lib/types";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { userFromAuth } from "@/lib/auth/session";

type AuthState = {
  user: User | null;
  setUser: (user: User | null) => void;
  login: (
    email: string,
    password: string,
    override?: User,
  ) => { ok: boolean; message: string };
  logout: () => Promise<void>;
  syncFromSupabase: () => Promise<void>;
};

export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      setUser: (user) => set({ user }),
      login: (_email, _password, override) => {
        if (override) {
          set({ user: override });
          return { ok: true, message: "Signed in." };
        }
        return { ok: false, message: "Sign in failed." };
      },
      logout: async () => {
        if (isSupabaseConfigured()) {
          try {
            await createClient().auth.signOut();
          } catch {
            // Clear local session even if remote sign-out fails.
          }
        }
        set({ user: null });
      },
      syncFromSupabase: async () => {
        if (!isSupabaseConfigured()) return;
        try {
          const supabase = createClient();
          const {
            data: { user },
          } = await supabase.auth.getUser();
          if (user) {
            const { data: profile } = await supabase
              .from("profiles")
              .select("email, full_name")
              .eq("id", user.id)
              .maybeSingle();
            set({
              user: {
                email: profile?.email ?? user.email ?? "",
                name:
                  profile?.full_name ||
                  userFromAuth(user).name,
              },
            });
          }
        } catch {
          // Keep persisted user if the network blip fails.
        }
      },
    }),
    { name: "rappi-auth", skipHydration: true },
  ),
);
