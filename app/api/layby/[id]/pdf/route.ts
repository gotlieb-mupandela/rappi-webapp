import { NextResponse } from "next/server";
import { buildLaybyPdf, laybyPdfFilename } from "@/lib/layby-pdf";
import { loadLaybyDoc } from "@/lib/layby-server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/** Layby agreement and statement PDF, for the customer who owns it or staff. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = (await params).id.toUpperCase();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  // RLS: customers can only read their own laybys; admins can read all.
  const { data: visible } = await supabase.from("laybys").select("id").eq("id", id).maybeSingle();
  if (!visible) return NextResponse.json({ error: "Layby not found." }, { status: 404 });
  const doc = await loadLaybyDoc(id);
  if (!doc) return NextResponse.json({ error: "Layby not found." }, { status: 404 });
  const pdf = await buildLaybyPdf(doc);
  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${laybyPdfFilename(id)}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
