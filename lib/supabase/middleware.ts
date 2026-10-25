import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/database.types";

export async function updateSession(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const isAdminRoute = path.startsWith("/admin");

  // Anonymous storefront / account / API: skip auth round-trip (saves Edge + latency).
  if (!isAdminRoute) {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });

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
        supabaseResponse = NextResponse.next({ request });
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
        const redirect = NextResponse.redirect(new URL("/admin", request.url));
        supabaseResponse.cookies.getAll().forEach((c) => redirect.cookies.set(c));
        return redirect;
      }
    }
    return supabaseResponse;
  }

  if (!user) {
    const redirect = NextResponse.redirect(new URL("/admin/login", request.url));
    supabaseResponse.cookies.getAll().forEach((c) => redirect.cookies.set(c));
    return redirect;
  }

  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) {
    const redirect = NextResponse.redirect(new URL("/admin/login?error=forbidden", request.url));
    supabaseResponse.cookies.getAll().forEach((c) => redirect.cookies.set(c));
    return redirect;
  }

  return supabaseResponse;
}
