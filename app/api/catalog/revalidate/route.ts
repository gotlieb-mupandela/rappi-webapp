import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { revalidateCatalog } from "@/lib/admin/revalidate-catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function secretsMatch(provided: string, expected: string) {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

function authorized(request: Request) {
  const expected = process.env.CATALOG_REVALIDATE_SECRET?.trim() ?? "";
  if (!expected) return false;
  const header = request.headers.get("authorization") ?? "";
  const bearer = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  const custom = request.headers.get("x-catalog-revalidate-secret") ?? "";
  return secretsMatch(bearer, expected) || secretsMatch(custom, expected);
}

export async function POST(request: Request) {
  if (!process.env.CATALOG_REVALIDATE_SECRET?.trim()) {
    return NextResponse.json({ error: "Catalog revalidate is not configured." }, { status: 503 });
  }
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  revalidateCatalog();
  return NextResponse.json({ ok: true, tag: "catalog" });
}
