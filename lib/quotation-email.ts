import "server-only";

import { escapeHtml } from "@/lib/html-escape";
import { formatInvoiceMoney, invoiceSeller } from "@/lib/invoice-pdf";
import type { QuotationPdfData } from "@/lib/quotation-pdf";
import { QUOTATION_VALID_DAYS, quotationFilename } from "@/lib/quotation-pdf";
import { brandLogoUrl, sendPdfEmail } from "@/lib/resend-pdf";

export async function sendQuotationEmail(data: QuotationPdfData, pdf: Uint8Array, to: string) {
  const seller = invoiceSeller();
  const logo = escapeHtml(brandLogoUrl());
  const name = escapeHtml(seller.legalName);
  await sendPdfEmail({
    to,
    subject: `Quotation ${data.id} - ${seller.legalName}`,
    filename: quotationFilename(data.id),
    pdf,
    html: [
      `<div style="font-family:Arial,sans-serif;color:#111;max-width:560px">`,
      `<div style="background:#ffffff;border-bottom:3px solid #5eff38;padding:16px 0">`,
      `<img src="${logo}" alt="${name}" width="160" style="display:block;height:auto" />`,
      `</div>`,
      `<p>Your quotation <strong>${escapeHtml(data.id)}</strong> is attached.</p>`,
      `<p>Merchandise subtotal: <strong>${escapeHtml(formatInvoiceMoney(data.subtotal))}</strong></p>`,
      `<p>Valid for ${QUOTATION_VALID_DAYS} days. This quotation does not reserve stock. VAT and delivery are added at checkout. This is not a tax invoice.</p>`,
      `<p>${name}</p>`,
      `</div>`,
    ].join(""),
  });
}
