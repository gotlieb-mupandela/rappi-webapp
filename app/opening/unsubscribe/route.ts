import { NextResponse } from "next/server";
import { checkUnsubscribe } from "@/lib/opening";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function unsubscribe(req: Request) {
  const url = new URL(req.url);
  const leadId = url.searchParams.get("l") ?? "";
  const token = url.searchParams.get("t") ?? "";
  if (!checkUnsubscribe(leadId, token)) return page("This unsubscribe link is not valid.", 400);
  const admin = createAdminClient();
  const { error } = await admin
    .from("opening_leads")
    .update({ unsubscribed_at: new Date().toISOString() })
    .eq("id", leadId)
    .is("unsubscribed_at", null);
  if (error) {
    console.error("opening unsubscribe", error.message);
    return page("Something went wrong. Please try again later.", 500);
  }
  return page("You're unsubscribed. We won't send you more opening emails. Your coupon still works.", 200);
}

function page(message: string, status: number) {
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>RAPPI Sports Hub</title></head>
<body style="font-family:Arial,sans-serif;background:#f4f4f4;margin:0;padding:40px 16px"><div style="max-width:480px;margin:0 auto;background:#fff;border-radius:12px;padding:28px;border-top:4px solid #5eff38">
<p style="font-size:16px;line-height:24px;margin:0">${message}</p>
<p style="margin:20px 0 0"><a href="/" style="color:#111">Back to rappisportshub.com</a></p></div></body></html>`;
  return new NextResponse(html, { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}

export const GET = unsubscribe;
export const POST = unsubscribe;
