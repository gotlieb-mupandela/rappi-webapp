import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createRequestClient } from "@/lib/supabase/request";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const companyRef = (new URL(request.url).searchParams.get("companyRef") ?? "").trim();
  if (!companyRef || companyRef.length > 100) {
    return NextResponse.json({ error: "Missing payment reference." }, { status: 400 });
  }

  const supabase = await createRequestClient(request);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("payments")
    .select("status, order_id")
    .eq("company_ref", companyRef)
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) {
    console.error("payment status", error.message);
    return NextResponse.json({ error: "Could not check payment." }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Payment not found." }, { status: 404 });
  }

  return NextResponse.json(
    { status: data.status, orderId: data.order_id },
    { headers: { "Cache-Control": "no-store" } },
  );
}
