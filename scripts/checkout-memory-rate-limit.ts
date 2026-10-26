type Bucket = { start: number; hits: number };

let buckets = new Map<string, Bucket>();
let failNext = false;

/**
 * Local stand-in only. Ignored for production and Vercel preview.
 * This file is not imported by the Next.js routes.
 */
export function memoryRateLimitAllowed() {
  const vercel = process.env.VERCEL_ENV;
  if (vercel === "production" || vercel === "preview") return false;
  if (process.env.NODE_ENV === "production") return false;
  return true;
}

export const checkoutRateLimitBackend = "memory";

export function requestIp(req: Request) {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const real = req.headers.get("x-real-ip")?.trim();
  return forwarded || real || "unknown";
}

/** Test hook: the next consumeRateLimit call throws and must fail closed. */
export function memoryRateLimitFailNext() {
  failNext = true;
}

export function resetMemoryRateLimit() {
  buckets = new Map();
  failNext = false;
}

/** Same contract as consume_rate_limit:  false when the store errors or the window is full. */
export async function consumeRateLimit(key: string, max: number, windowSeconds = 3600) {
  try {
    if (failNext) {
      failNext = false;
      throw new Error("memory rate limit store failed");
    }
    if (!String(key ?? "").trim()) return false;
    if (!Number.isFinite(max) || max < 1 || !Number.isFinite(windowSeconds) || windowSeconds < 1) {
      return false;
    }
    const now = Date.now();
    const windowMs = windowSeconds * 1000;
    const row = buckets.get(key);
    if (!row || now - row.start >= windowMs) {
      buckets.set(key, { start: now, hits: 1 });
      return true;
    }
    row.hits += 1;
    return row.hits <= max;
  } catch {
    return false;
  }
}
