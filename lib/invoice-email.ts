import { createAdminClient } from "@/lib/supabase/admin";
import { buildInvoicePdf, invoiceFilename, loadInvoiceData } from "@/lib/invoice-pdf";
import { renderOrderEmail } from "@/lib/order-emails";
import { orderEmailBase, recordNotification } from "@/lib/order-notify";
import { sendPdfEmail } from "@/lib/resend-pdf";

export type SendInvoiceResult =
  | { sent: true }
  | { sent: false; skipped: "already_sent" | "cancelled" | "not_found" | "missing_email" }
  | { sent: false; error: string };

function errorMessage(err: unknown) {
  return err instanceof Error ? err.message : "Invoice send failed.";
}

export async function sendOrderInvoice(
  orderId: string,
  options?: { force?: boolean },
): Promise<SendInvoiceResult> {
  const admin = createAdminClient();

  if (options?.force) {
    const { error: resetError } = await admin
      .from("orders")
      .update({ invoice_sent_at: null, invoice_last_error: null })
      .eq("id", orderId);
    if (resetError) return { sent: false, error: resetError.message };
  }

  const claimedAt = new Date().toISOString();
  const { data: claimed, error: claimError } = await admin
    .from("orders")
    .update({ invoice_sent_at: claimedAt, invoice_last_error: null })
    .eq("id", orderId)
    .is("invoice_sent_at", null)
    .select("id, email, status")
    .maybeSingle();

  if (claimError) return { sent: false, error: claimError.message };
  if (!claimed) {
    const { data: existing } = await admin.from("orders").select("id").eq("id", orderId).maybeSingle();
    return existing ? { sent: false, skipped: "already_sent" } : { sent: false, skipped: "not_found" };
  }

  if (!options?.force && claimed.status === "cancelled") {
    await admin.from("orders").update({ invoice_sent_at: null }).eq("id", orderId);
    return { sent: false, skipped: "cancelled" };
  }

  const releaseClaim = async (message: string) => {
    await admin
      .from("orders")
      .update({ invoice_sent_at: null, invoice_last_error: message.slice(0, 500) })
      .eq("id", orderId)
      .eq("invoice_sent_at", claimedAt);
  };

  try {
    const data = await loadInvoiceData(orderId);
    if (!data) {
      await releaseClaim("Order not found.");
      return { sent: false, skipped: "not_found" };
    }

    const to = data.order.email.trim();
    if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      await releaseClaim("Order is missing a valid customer email.");
      return { sent: false, skipped: "missing_email" };
    }

    const pdf = await buildInvoicePdf(data);
    const email = renderOrderEmail("paid", {
      ...orderEmailBase(),
      order: data.order,
      items: data.items,
    });
    await sendPdfEmail({
      to,
      subject: email.subject,
      html: email.html,
      text: email.text,
      filename: invoiceFilename(data.order.id),
      pdf,
    });
    try {
      await recordNotification(data.order.id, "paid", to);
    } catch {
      // The log is informational only.
    }
    return { sent: true };
  } catch (err) {
    const message = errorMessage(err);
    await releaseClaim(message);
    console.error("invoice email", message);
    return { sent: false, error: message };
  }
}
