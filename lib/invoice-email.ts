import { contactEmail } from "@/lib/site-contact";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  buildInvoicePdf,
  formatInvoiceMoney,
  invoiceFilename,
  invoiceSeller,
  loadInvoiceData,
} from "@/lib/invoice-pdf";

export type SendInvoiceResult =
  | { sent: true }
  | { sent: false; skipped: "already_sent" | "cancelled" | "not_found" | "missing_email" }
  | { sent: false; error: string };

function errorMessage(err: unknown) {
  return err instanceof Error ? err.message : "Invoice send failed.";
}

function bytesToBase64(bytes: Uint8Array) {
  return Buffer.from(bytes).toString("base64");
}

function invoiceLogoUrl() {
  const site = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.rappisportshub.com").replace(/\/$/, "");
  return `${site}/brand/logo-dark.png`;
}

async function sendResendEmail(input: {
  to: string;
  subject: string;
  html: string;
  filename: string;
  pdf: Uint8Array;
}) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not set.");
  }

  const seller = invoiceSeller();
  const from = `${seller.legalName} <${seller.email}>`;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      reply_to: contactEmail(),
      subject: input.subject,
      html: input.html,
      attachments: [
        {
          filename: input.filename,
          content: bytesToBase64(input.pdf),
        },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(body.slice(0, 400) || `Resend HTTP ${res.status}`);
  }
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
    await sendResendEmail({
      to,
      subject: `Invoice ${data.order.id} — ${seller.legalName}`,
      html: [
        `<div style="font-family:Arial,sans-serif;color:#111">`,
        `<div style="background:#ffffff;border-bottom:3px solid #5eff38;padding:16px 20px">`,
        `<img src="${escapeHtml(invoiceLogoUrl())}" alt="${escapeHtml(seller.legalName)}" width="160" style="display:block;height:auto" />`,
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

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
