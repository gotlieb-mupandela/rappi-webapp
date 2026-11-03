import { NextResponse } from "next/server";
import { revalidateCatalog } from "@/lib/admin/revalidate-catalog";
import { parseJomaExport, previewJomaSync } from "@/lib/joma-sync";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Sign in required." }, { status: 401 }) };
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) return { error: NextResponse.json({ error: "Not authorized." }, { status: 403 }) };
  return { supabase };
}

async function knownCodes(supabase: Awaited<ReturnType<typeof createClient>>) {
  const codes = new Set<string>();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from("products").select("code").range(from, from + 999);
    if (error) throw new Error(error.message);
    for (const row of data ?? []) codes.add(row.code);
    if (!data || data.length < 1000) break;
  }
  return codes;
}

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if ("error" in auth && auth.error) return auth.error;
  const supabase = auth.supabase!;

  let body: { dump?: unknown; filename?: string; apply?: boolean };
  try {
    body = (await req.json()) as { dump?: unknown; filename?: string; apply?: boolean };
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const parsed = parseJomaExport(body.dump);
  if (!parsed.length) {
    return NextResponse.json({ error: "No product rows found in the export." }, { status: 400 });
  }

  let codes: Set<string>;
  try {
    codes = await knownCodes(supabase);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not load products." },
      { status: 500 },
    );
  }

  const preview = previewJomaSync(parsed, codes);
  if (!body.apply) {
    return NextResponse.json({
      parsed: parsed.length,
      matched: preview.matched.length,
      unmatched: preview.unmatched,
      sample: preview.matched.slice(0, 20),
    });
  }

  const { data, error } = await supabase.rpc("apply_stock_sync", {
    p_rows: preview.matched,
    p_filename: String(body.filename ?? "").slice(0, 200),
    p_unmatched: preview.unmatched.slice(0, 500),
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  revalidateCatalog();
  return NextResponse.json({ ok: true, result: data, unmatched: preview.unmatched });
}
