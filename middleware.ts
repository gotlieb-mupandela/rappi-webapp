import { NextResponse, type NextRequest } from "next/server";
import { fixedSlugRedirect } from "@/lib/slug-redirects";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  const target = fixedSlugRedirect(request.nextUrl.pathname, request.nextUrl.searchParams);
  if (target) {
    const url = request.nextUrl.clone();
    const splitAt = target.indexOf("?");
    // Path and search come only from the fixed table target.
    url.pathname = splitAt === -1 ? target : target.slice(0, splitAt);
    url.search = splitAt === -1 ? "" : target.slice(splitAt);
    return NextResponse.redirect(url, 308);
  }
  return updateSession(request);
}

export const config = {
  matcher: ["/admin/:path*", "/shop/:path*", "/category/:path*"],
};
