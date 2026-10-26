import "server-only";

import { NextResponse } from "next/server";
import { consumeRateLimit, requestIp } from "@/lib/rate-limit";

const LIMIT = 60;
const WINDOW_SECONDS = 60;

export function methodNotAllowed() {
  return NextResponse.json(
    { error: "Method not allowed." },
    { status: 405, headers: { Allow: "GET" } },
  );
}

/** Fail closed: a limiter error or a rejected call both refuse the request. */
export async function enforceMobileRateLimit(request: Request, bucket: string) {
  let allowed = false;
  try {
    allowed = await consumeRateLimit(
      `mobile-v1-${bucket}:${requestIp(request)}`,
      LIMIT,
      WINDOW_SECONDS,
    );
  } catch {
    allowed = false;
  }
  if (!allowed) {
    return NextResponse.json({ error: "Too many requests. Try again later." }, { status: 429 });
  }
  return null;
}

export function cacheHeaders(value: string): HeadersInit {
  return {
    "Cache-Control": value,
    "CDN-Cache-Control": value,
  };
}
