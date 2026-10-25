import { NextResponse } from "next/server";
import { sendOrderInvoice } from "@/lib/invoice-email";
import { buildInvoicePdf, invoiceFilename, loadInvoiceData } from "@/lib/invoice-pdf";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

async function currentUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: isAdmin } = await supabase.rpc("is_admin");
  return { user, isAdmin: Boolean(isAdmin) };
}

function canReadInvoice(session: { user: { id: string }; isAdmin: boolean }, orderUserId: string | null) {
  return session.isAdmin || Boolean(orderUserId && orderUserId === session.user.id);
}

export async function GET(_req: Request, context: RouteContext) {
  const session = await currentUser();
  if (!session) {
    return NextResponse.json({ error: "Sign in to view this invoice." }, { status: 401 });
  }

  const { id } = await context.params;
  try {
    const data = await loadInvoiceData(id);
    if (!data || !canReadInvoice(session, data.order.user_id)) {
      return NextResponse.json({ error: "Invoice not found." }, { status: 404 });
    }

    const pdf = await buildInvoicePdf(data);
    return new NextResponse(Buffer.from(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${invoiceFilename(data.order.id)}"`,
      },
    });
  } catch (err) {
    console.error("invoice download", err);
    return NextResponse.json({ error: "Could not build the invoice." }, { status: 500 });
  }
}

export async function POST(_req: Request, context: RouteContext) {
  const session = await currentUser();
  if (!session) {
    return NextResponse.json({ error: "Sign in to email this invoice." }, { status: 401 });
  }
  if (!session.isAdmin) {
    return NextResponse.json({ error: "Only staff can email an invoice." }, { status: 403 });
  }

  const { id } = await context.params;
  try {
    const data = await loadInvoiceData(id);
    if (!data) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }

    const result = await sendOrderInvoice(id, { force: true });
    if (!result.sent) {
      const message = "error" in result ? result.error : `Invoice was not sent (${result.skipped}).`;
      return NextResponse.json({ error: message }, { status: 502 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("invoice resend", err);
    return NextResponse.json({ error: "Could not email the invoice." }, { status: 500 });
  }
}
