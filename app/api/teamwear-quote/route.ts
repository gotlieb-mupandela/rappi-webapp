import { NextResponse } from "next/server";
import { consumeRateLimit, requestIp } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

function text(value: unknown, max: number) {
  return String(value ?? "").trim().slice(0, max);
}

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const name = text(body.name, 120);
  const email = text(body.email, 160).toLowerCase();
  const organisation = text(body.organisation, 160);
  const sport = text(body.sport, 80);
  const players = text(body.players, 40);
  const sizes = text(body.sizes, 240);
  const notes = text(body.notes, 2000);

  if (!name || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Enter a name and a valid email." }, { status: 400 });
  }
  if (!organisation) {
    return NextResponse.json({ error: "Enter the school, club or team." }, { status: 400 });
  }

  const allowed = await consumeRateLimit(`teamwear-quote:${requestIp(req)}`, 5);
  if (!allowed) {
    return NextResponse.json({ error: "Too many requests. Try again later." }, { status: 429 });
  }

  try {
    const admin = createAdminClient();
    const { error } = await admin.from("teamwear_quotes").insert({
      name,
      email,
      organisation,
      sport,
      players,
      sizes,
      notes,
    });
    if (error) {
      console.error("teamwear quote insert", error.message);
      return NextResponse.json({ error: "Could not save the quote request." }, { status: 500 });
    }
  } catch (err) {
    console.error("teamwear quote", err);
    return NextResponse.json({ error: "Could not save the quote request." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
