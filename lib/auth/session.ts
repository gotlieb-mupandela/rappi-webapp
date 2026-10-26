import { isNativeApp, nativeAuthRedirect } from "@/lib/native";
import type { User } from "@/lib/types";

/** Exact identities left over from the old demo shop. Never shown as a person's name. */
const PLACEHOLDER_NAMES = new Set([
  "demo",
  "demo shop customer",
  "client boutique demo",
  "rappi shop",
]);

export type ProfileIdentity = {
  email?: string | null;
  full_name?: string | null;
  role?: string | null;
};

function normalizeIdentity(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/** Drop blank values and demo-shop placeholders. A real name is returned unchanged. */
export function usableName(value: unknown): string {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed || PLACEHOLDER_NAMES.has(normalizeIdentity(trimmed))) return "";
  return trimmed;
}

function emailLocalPart(email: string) {
  return email.split("@")[0]?.trim() ?? "";
}

export function accountRole(role: string | null | undefined): "customer" | "admin" {
  return role === "admin" ? "admin" : "customer";
}

/** Message key for the account role line. Never returns a demo label. */
export function accountRoleKey(role: string | null | undefined) {
  return accountRole(role) === "admin" ? "account.roleAdmin" : "account.roleCustomer";
}

export function displayName(user: { name?: string | null; email?: string | null }) {
  const email = (user.email ?? "").trim();
  return usableName(user.name) || emailLocalPart(email) || email;
}

export function userFromAuth(user: {
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
}): User {
  const meta = user.user_metadata ?? {};
  const email = (user.email ?? "").trim();
  const name =
    usableName(meta.full_name) ||
    usableName(meta.name) ||
    usableName(meta.fullName) ||
    emailLocalPart(email) ||
    email;
  return { email, name, role: "customer" };
}

/** Profile row wins for name, email, and role. Auth metadata fills any gap. */
export function userFromProfile(
  authUser: {
    email?: string | null;
    user_metadata?: Record<string, unknown> | null;
  },
  profile?: ProfileIdentity | null,
): User {
  const fromAuth = userFromAuth(authUser);
  const email = (profile?.email ?? "").trim() || fromAuth.email;
  const name = usableName(profile?.full_name) || fromAuth.name || emailLocalPart(email) || email;
  return {
    email,
    name,
    role: accountRole(profile?.role),
  };
}

/** Longer than a real in-site path. Huge values are rejected instead of pushed. */
const MAX_NEXT_PATH_LENGTH = 2048;

/**
 * Percent-encoded controls (%00-%1F and %7F) plus encoded slash (%2F)
 * and encoded backslash (%5C). Checked on the raw string, any case.
 */
const ENCODED_CONTROL_OR_SLASH = /%(?:[01][0-9a-f]|7f|2f|5c)/i;

function hasControlOrWhitespace(value: string) {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code <= 0x20 || code === 0x7f) return true;
  }
  return /\s/.test(value);
}

/**
 * In-site path for post-login navigation. Query strings and hashes stay.
 * Control characters and whitespace are rejected because URL parsers strip
 * them. A tab between slashes is enough for the origin to change.
 */
export function safeNextPath(raw: string | null | undefined, fallback = "/") {
  if (
    !raw ||
    raw.length > MAX_NEXT_PATH_LENGTH ||
    hasControlOrWhitespace(raw) ||
    ENCODED_CONTROL_OR_SLASH.test(raw) ||
    !raw.startsWith("/") ||
    raw.startsWith("//") ||
    raw.includes("\\") ||
    raw.includes("//")
  ) {
    return fallback;
  }
  try {
    if (new URL(raw, "https://x.invalid").origin !== "https://x.invalid") {
      return fallback;
    }
  } catch {
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
