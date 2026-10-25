import { NextResponse } from "next/server";
import { revalidateCatalog } from "@/lib/admin/revalidate-catalog";
import { secretsMatch } from "@/lib/catalog-revalidate-auth";
import { consumeRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Shared budget for a valid secret. Fixed key, 12 clears per hour, via consume_rate_limit. */
const REVALIDATE_LIMIT_KEY = "catalog-revalidate";
const REVALIDATE_LIMIT = 12;
const REVALIDATE_WINDOW_SECONDS = 3600;

function headerAuthorized(request: Request, expected: string) {
  const header = request.headers.get("authorization") ?? "";
  const bearer = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  const custom = request.headers.get("x-catalog-revalidate-secret") ?? "";
  const bearerOk = secretsMatch(bearer, expected);
  const customOk = secretsMatch(custom, expected);
  return bearerOk || customOk;
}

function methodNotAllowed() {
  return NextResponse.json(
    { error: "Method not allowed." },
    { status: 405, headers: { Allow: "POST" } },
  );
}

export function GET() {
  return methodNotAllowed();
}

export function PUT() {
  return methodNotAllowed();
}

export function PATCH() {
  return methodNotAllowed();
}

export function DELETE() {
  return methodNotAllowed();
}

export function HEAD() {
  return methodNotAllowed();
}

export function OPTIONS() {
  return methodNotAllowed();
}

export async function POST(request: Request) {
  const expected = process.env.CATALOG_REVALIDATE_SECRET?.trim() ?? "";
  if (!expected) {
    return NextResponse.json({ error: "Catalog revalidate is not configured." }, { status: 503 });
  }
  if (!headerAuthorized(request, expected)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let allowed = false;
  try {
    allowed = await consumeRateLimit(REVALIDATE_LIMIT_KEY, REVALIDATE_LIMIT, REVALIDATE_WINDOW_SECONDS);
  } catch {
    allowed = false;
  }
  if (!allowed) {
    return NextResponse.json({ error: "Too many requests. Try again later." }, { status: 429 });
  }

  revalidateCatalog();
  return NextResponse.json({ ok: true, tag: "catalog" });
}
