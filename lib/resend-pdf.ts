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

export type EmailAttachment = { filename: string; content: Uint8Array };

/** Sends one email through Resend from the shop address, replies going to the contact inbox. */
export async function sendEmail(input: {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  attachments?: EmailAttachment[];
  headers?: Record<string, string>;
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
      to: Array.isArray(input.to) ? input.to : [input.to],
      reply_to: contactEmail(),
      subject: input.subject,
      html: input.html,
      ...(input.text ? { text: input.text } : {}),
      ...(input.headers ? { headers: input.headers } : {}),
      ...(input.attachments?.length
        ? {
            attachments: input.attachments.map((a) => ({
              filename: a.filename,
              content: bytesToBase64(a.content),
              // Explicit type so mail apps (Gmail on Android) download it as a PDF.
              content_type: a.filename.toLowerCase().endsWith(".pdf") ? "application/pdf" : "application/octet-stream",
            })),
          }
        : {}),
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(body.slice(0, 400) || `Resend HTTP ${res.status}`);
  }
}

export async function sendPdfEmail(input: {
  to: string;
  subject: string;
  html: string;
  text?: string;
  filename: string;
  pdf: Uint8Array;
}) {
  await sendEmail({
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
    attachments: [{ filename: input.filename, content: input.pdf }],
  });
}
