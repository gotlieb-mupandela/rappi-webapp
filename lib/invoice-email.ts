import { escapeHtml } from "@/lib/html-escape";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  buildInvoicePdf,
  formatInvoiceMoney,
  invoiceFilename,
  invoiceSeller,
  loadInvoiceData,
} from "@/lib/invoice-pdf";
import { brandLogoUrl, sendPdfEmail } from "@/lib/resend-pdf";

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
    const seller = invoiceSeller();
    await sendPdfEmail({
      to,
      subject: `Invoice ${data.order.id} - ${seller.legalName}`,
      html: [
        `<div style="font-family:Arial,sans-serif;color:#111">`,
        `<div style="background:#ffffff;border-bottom:3px solid #5eff38;padding:16px 20px">`,
        `<img src="${escapeHtml(brandLogoUrl())}" alt="${escapeHtml(seller.legalName)}" width="160" style="display:block;height:auto" />`,
        `</div>`,
        `<p>Hi ${escapeHtml(data.order.full_name)},</p>`,
        `<p>Thank you for your order <strong>${escapeHtml(data.order.id)}</strong>. Your invoice is attached.</p>`,
        `<p>Total: <strong>${formatInvoiceMoney(Number(data.order.total))}</strong></p>`,
        `<p>${escapeHtml(seller.legalName)}</p>`,
        `</div>`,
      ].join(""),
      filename: invoiceFilename(data.order.id),
      pdf,
    });
    return { sent: true };
  } catch (err) {
    const message = errorMessage(err);
    await releaseClaim(message);
    console.error("invoice email", message);
    return { sent: false, error: message };
  }
}
