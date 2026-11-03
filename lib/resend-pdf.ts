import "server-only";

import { contactEmail } from "@/lib/site-contact";
import { invoiceSeller } from "@/lib/invoice-pdf";

export function brandLogoUrl() {
  const site = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.rappisportshub.com").replace(/\/$/, "");
  return `${site}/brand/logo-dark.png`;
}

function bytesToBase64(bytes: Uint8Array) {
  return Buffer.from(bytes).toString("base64");
}

export async function sendPdfEmail(input: {
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
