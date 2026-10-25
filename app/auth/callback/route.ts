import { NextResponse } from "next/server";
import { safeNextPath } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

const SITE_URL = "https://www.rappisportshub.com";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next"), "/account");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const isLocalEnv = process.env.NODE_ENV === "development";
      if (isLocalEnv) {
        return NextResponse.redirect(`${origin}${next}`);
      }
      const site = (process.env.NEXT_PUBLIC_SITE_URL || SITE_URL).replace(/\/$/, "");
      return NextResponse.redirect(`${site}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
