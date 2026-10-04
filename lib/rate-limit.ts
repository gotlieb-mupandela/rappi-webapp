import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export function requestIp(req: Request) {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const real = req.headers.get("x-real-ip")?.trim();
  return forwarded || real || "unknown";
}

export async function consumeRateLimit(key: string, max: number, windowSeconds = 3600) {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("consume_rate_limit", {
    p_key: key,
    p_max: max,
    p_window_seconds: windowSeconds,
  });
  if (error) {
    console.error("rate limit", error.message);
    return false;
  }
  return data === true;
}
