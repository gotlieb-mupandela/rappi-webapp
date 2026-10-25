import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import {
  buildMetaCatalogTsv,
  metaCatalogFeedFilename,
} from "@/lib/meta/catalog-feed";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function providedToken(request: Request) {
  const url = new URL(request.url);
  const query = url.searchParams.get("token") ?? "";
  const header = request.headers.get("authorization") ?? "";
  const bearer = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
  return query || bearer;
}

function tokensMatch(provided: string, expected: string) {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (!provided || a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function GET(request: Request) {
  const expected = process.env.META_CATALOG_FEED_TOKEN?.trim() ?? "";
  if (!expected) {
    return NextResponse.json({ error: "Meta catalog feed is not configured." }, { status: 503 });
  }
  if (!tokensMatch(providedToken(request), expected)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = await buildMetaCatalogTsv();
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/tab-separated-values; charset=utf-8",
      "Content-Disposition": `attachment; filename="${metaCatalogFeedFilename()}"`,
      "Cache-Control": "public, s-maxage=900, stale-while-revalidate=3600",
    },
  });
}
