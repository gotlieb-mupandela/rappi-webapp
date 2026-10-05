import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { createClient as createCookieClient } from "@/lib/supabase/server";

function bearerToken(request: Request) {
  const header = request.headers.get("authorization")?.trim() ?? "";
  if (!header.toLowerCase().startsWith("bearer ")) return null;
  const token = header.slice(7).trim();
  return token || null;
}

/**
 * Uses the mobile Bearer token when present and otherwise preserves the
 * website's cookie session. The Authorization header must remain on the
 * client so RLS applies to queries after getUser() verifies the JWT.
 */
export async function createRequestClient(request: Request) {
  const token = bearerToken(request);
  if (!token) return createCookieClient();

  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
      global: {
        headers: { Authorization: `Bearer ${token}` },
      },
    },
  );
}
