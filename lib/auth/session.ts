import { isNativeApp, nativeAuthRedirect } from "@/lib/native";
import type { User } from "@/lib/types";

export function userFromAuth(user: {
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
}): User {
  const meta = user.user_metadata ?? {};
  const fullName =
    (typeof meta.full_name === "string" && meta.full_name) ||
    (typeof meta.name === "string" && meta.name) ||
    (typeof meta.fullName === "string" && meta.fullName) ||
    "";
  const email = user.email ?? "";
  return {
    email,
    name: fullName || email.split("@")[0] || "RAPPI Shop",
  };
}

export function safeNextPath(raw: string | null | undefined, fallback = "/") {
  if (
    !raw ||
    !raw.startsWith("/") ||
    raw.startsWith("//") ||
    raw.includes("\\") ||
    raw.includes("//")
  ) {
    return fallback;
  }
  return raw;
}

export function authCallbackUrl(next = "/") {
  const dest = safeNextPath(next, "/");
  if (typeof window !== "undefined" && isNativeApp()) {
    return nativeAuthRedirect(dest);
  }
  const path = `/auth/callback?next=${encodeURIComponent(dest)}`;
  if (typeof window !== "undefined") {
    return `${window.location.origin}${path}`;
  }
  const site = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  return site ? `${site}${path}` : path;
}
