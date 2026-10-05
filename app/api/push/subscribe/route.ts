import { NextResponse } from "next/server";
import type { Database } from "@/lib/database.types";
import { createRequestClient } from "@/lib/supabase/request";

export const runtime = "nodejs";

type Platform = Database["public"]["Enums"]["push_platform"];

function isPlatform(value: unknown): value is Platform {
  return value === "web" || value === "ios" || value === "android";
}

function readEndpoint(body: Record<string, unknown>) {
  const endpoint = String(body.endpoint ?? "").trim();
  if (!endpoint || endpoint.length > 2048) return null;
  return endpoint;
}

function readExpoToken(body: Record<string, unknown>) {
  const token = String(body.expoToken ?? body.expo_token ?? "").trim();
  if (!token || token.length > 2048) return null;
  return token;
}

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const endpoint = readEndpoint(body);
  const expoToken = readExpoToken(body);
  const keys = (body.keys ?? {}) as Record<string, unknown>;
  const p256dh = String(keys.p256dh ?? body.p256dh ?? "").trim() || null;
  const auth = String(keys.auth ?? body.auth ?? "").trim() || null;
  const platform = isPlatform(body.platform) ? body.platform : "web";
  const userAgent = String(body.userAgent ?? req.headers.get("user-agent") ?? "").slice(0, 400);

  if (platform === "web") {
    if (!endpoint) {
      return NextResponse.json({ error: "Missing endpoint." }, { status: 400 });
    }
    if (!p256dh || !auth) {
      return NextResponse.json({ error: "Missing subscription keys." }, { status: 400 });
    }
  } else if (!expoToken) {
    return NextResponse.json({ error: "Missing Expo push token." }, { status: 400 });
  }

  const supabase = await createRequestClient(req);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const target =
    platform === "web"
      ? {
          user_id: user.id,
          endpoint,
          expo_token: null,
          p256dh,
          auth,
          platform,
          user_agent: userAgent,
        }
      : {
          user_id: user.id,
          endpoint: null,
          expo_token: expoToken,
          p256dh: null,
          auth: null,
          platform,
          user_agent: userAgent,
        };
  const { error } = await supabase
    .from("push_subscriptions")
    .upsert(target, { onConflict: platform === "web" ? "endpoint" : "expo_token" });
  if (error) {
    console.error("push subscribe", error.message);
    return NextResponse.json({ error: "Could not save subscription." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }

  const endpoint = readEndpoint(body);
  const expoToken = readExpoToken(body);
  const supabase = await createRequestClient(req);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  let query = supabase.from("push_subscriptions").delete().eq("user_id", user.id);
  if (endpoint) query = query.eq("endpoint", endpoint);
  else if (expoToken) query = query.eq("expo_token", expoToken);
  const { error } = await query;
  if (error) {
    console.error("push unsubscribe", error.message);
    return NextResponse.json({ error: "Could not remove subscription." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
