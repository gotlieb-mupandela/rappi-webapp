import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/database.types";
import { CSP_REPORT_ONLY_HEADER } from "@/lib/content-security-policy";

/**
 * @param nonce per-request nonce, forwarded to the rendered route so Next can
 *   stamp it on its inline bootstrap scripts.
 * @param csp the full policy string; sent on every response as
 *   Content-Security-Policy-Report-Only, and forwarded on the request as
 *   Content-Security-Policy so Next reads the nonce from it.
 */
export async function updateSession(request: NextRequest, nonce: string, csp: string) {
  // Request headers the rendered route sees. Next reads the nonce from the
  // forwarded Content-Security-Policy header; x-nonce is for our own scripts.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const newResponse = () => {
    const res = NextResponse.next({ request: { headers: requestHeaders } });
    res.headers.set(CSP_REPORT_ONLY_HEADER, csp);
    return res;
  };

  const redirectTo = (location: URL, from: NextResponse) => {
    const redirect = NextResponse.redirect(location);
    from.cookies.getAll().forEach((c) => redirect.cookies.set(c));
    redirect.headers.set(CSP_REPORT_ONLY_HEADER, csp);
    return redirect;
  };

  const path = request.nextUrl.pathname;
  const isAdminRoute = path.startsWith("/admin");

  // Anonymous storefront / account / API: skip auth round-trip (saves Edge + latency).
  if (!isAdminRoute) {
    return newResponse();
  }

  let supabaseResponse = newResponse();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return supabaseResponse;

  const supabase = createServerClient<Database>(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = newResponse();
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAdminLogin = path === "/admin/login";

  if (isAdminLogin) {
    if (user) {
      const { data: isAdmin } = await supabase.rpc("is_admin");
      if (isAdmin) {
        return redirectTo(new URL("/admin", request.url), supabaseResponse);
      }
    }
    return supabaseResponse;
  }

  if (!user) {
    return redirectTo(new URL("/admin/login", request.url), supabaseResponse);
  }

  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) {
    return redirectTo(new URL("/admin/login?error=forbidden", request.url), supabaseResponse);
  }

  return supabaseResponse;
}
