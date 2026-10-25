import { NextResponse, type NextRequest } from "next/server";
import { fixedSlugRedirect } from "@/lib/slug-redirects";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  const target = fixedSlugRedirect(request.nextUrl.pathname, request.nextUrl.searchParams);
  if (target) {
    return NextResponse.redirect(new URL(target, request.nextUrl.origin), 308);
  }
  return updateSession(request);
}

export const config = {
  matcher: ["/admin/:path*", "/shop/:path*", "/category/:path*"],
};
