"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User } from "@/lib/types";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { accountRole, displayName, userFromProfile } from "@/lib/auth/session";

function presentUser(user: User): User {
  return {
    email: user.email.trim(),
    name: displayName(user),
    role: accountRole(user.role),
  };
}

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
      setUser: (user) => set({ user: user ? presentUser(user) : null }),
      login: (_email, _password, override) => {
        if (override) {
          set({ user: presentUser(override) });
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
              .select("email, full_name, role")
              .eq("id", user.id)
              .maybeSingle();
            set({ user: userFromProfile(user, profile) });
          }
        } catch {
          // Keep persisted user if the network blip fails.
        }
      },
    }),
    {
      name: "rappi-auth",
      skipHydration: true,
      merge: (persisted, current) => {
        if (!persisted || typeof persisted !== "object") return current;
        const saved = persisted as Partial<AuthState>;
        const user = saved.user ? presentUser(saved.user) : null;
        return { ...current, ...saved, user };
      },
    },
  ),
);
