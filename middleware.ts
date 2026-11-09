import { NextResponse, type NextRequest } from "next/server";
import {
  contentSecurityPolicy,
  cspHeaderName,
} from "@/lib/content-security-policy";
import { securityHeaderEnv } from "@/lib/security-headers";
import { fixedSlugRedirect } from "@/lib/slug-redirects";
import { updateSession } from "@/lib/supabase/middleware";

/** Base64 nonce from 16 random bytes. Web Crypto + btoa exist on the Edge runtime. */
function generateNonce() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export async function middleware(request: NextRequest) {
  const nonce = generateNonce();
  const csp = contentSecurityPolicy(securityHeaderEnv(), nonce);
  // Report-only unless CSP_ENFORCE=true (see lib/content-security-policy.ts).
  const headerName = cspHeaderName();

  const target = fixedSlugRedirect(request.nextUrl.pathname, request.nextUrl.searchParams);
  if (target) {
    const url = request.nextUrl.clone();
    const splitAt = target.indexOf("?");
    // Path and search come only from the fixed table target.
    url.pathname = splitAt === -1 ? target : target.slice(0, splitAt);
    url.search = splitAt === -1 ? "" : target.slice(splitAt);
    const redirect = NextResponse.redirect(url, 308);
    redirect.headers.set(headerName, csp);
    return redirect;
  }

  return updateSession(request, nonce, csp, headerName);
}

export const config = {
  matcher: [
    /*
     * Run on every request so the CSP (with its per-request nonce) covers all
     * HTML responses, excluding Next internals and static asset files, which
     * do not execute inline scripts and are heavily cached:
     *  - _next/static, _next/image (framework assets / image optimizer)
     *  - the common static file extensions
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|webp|avif|ico|txt|xml|json|webmanifest|woff|woff2|ttf|map)$).*)",
  ],
};
