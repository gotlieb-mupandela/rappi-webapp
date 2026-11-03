import { NextResponse } from "next/server";
import { issueBagQuotation, markBagQuotationEmailed } from "@/lib/bag-quotation";
import { CartResolveError } from "@/lib/checkout-lines";
import { escapeHtml } from "@/lib/html-escape";
import { buildQuotationPdf, quotationFilename } from "@/lib/quotation-pdf";
import { sendQuotationEmail } from "@/lib/quotation-email";
import { consumeRateLimit, requestIp } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type QuotationRequest = {
  lines: unknown;
  delivery: "download" | "email";
  email?: string;
  quoteId?: string;
  token?: string;
};

type ParseResult =
  | { ok: true; value: QuotationRequest }
  | { ok: false; status: number; error: string; code: string };

function parseRequest(body: unknown): ParseResult {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, status: 400, error: "Invalid request.", code: "failed" };
  }
  const record = body as Record<string, unknown>;
  const delivery = record.delivery;
  if (delivery !== "download" && delivery !== "email") {
    return { ok: false, status: 400, error: "Invalid request.", code: "failed" };
  }

  let email: string | undefined;
  if (delivery === "email") {
    email = String(record.email ?? "").trim().toLowerCase().slice(0, 160);
    if (!EMAIL_RE.test(email)) {
      return { ok: false, status: 400, error: "Enter a valid email.", code: "invalid_email" };
    }
  }

  const quoteId = typeof record.quoteId === "string" ? record.quoteId.trim() : "";
  const token = typeof record.token === "string" ? record.token.trim() : "";
  if ((quoteId && !token) || (!quoteId && token) || (token && (token.length < 32 || token.length > 80))) {
    return { ok: false, status: 400, error: "Invalid request.", code: "failed" };
  }

  return {
    ok: true,
    value: {
      lines: record.lines,
      delivery,
      email,
      quoteId: quoteId || undefined,
      token: token || undefined,
    },
  };
}

async function enforceQuotationRateLimit(req: Request) {
  try {
    const allowed = await consumeRateLimit(`bag-quotation:${requestIp(req)}`, 8, 3600);
    if (!allowed) {
      return NextResponse.json(
        { error: "Too many quotations. Try again later.", code: "rate_limit" },
        { status: 429 },
      );
    }
  } catch (err) {
    console.error("quotation rate limit", err instanceof Error ? err.message : "failed");
    return NextResponse.json(
      { error: "Too many quotations. Try again later.", code: "rate_limit" },
      { status: 429 },
    );
  }
  return null;
}

function pdfResponse(pdf: Uint8Array, id: string, token: string) {
  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${quotationFilename(id)}"`,
      "Cache-Control": "no-store",
      "X-Quote-Id": id,
      "X-Quote-Token": token,
    },
  });
}

function emailFailure(err: unknown) {
  const message = err instanceof Error ? err.message : "";
  console.error("quotation email", message);
  if (message.includes("RESEND_API_KEY")) {
    return {
      status: 503,
      code: "email_unavailable",
      error: "Email is not available right now. Download the PDF instead.",
    };
  }
  return {
    status: 502,
    code: "email_failed",
    error: "Could not email the quotation. Download the PDF instead.",
  };
}

export async function POST(req: Request) {
  const blocked = await enforceQuotationRateLimit(req);
  if (blocked) return blocked;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request.", code: "failed" }, { status: 400 });
  }

  const parsed = parseRequest(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error, code: parsed.code }, { status: parsed.status });
  }

  try {
    const issued = await issueBagQuotation({
      lines: parsed.value.lines,
      email: parsed.value.email,
      quoteId: parsed.value.quoteId,
      token: parsed.value.token,
    });
    if (!issued.ok) {
      return NextResponse.json({ error: issued.error, code: issued.code }, { status: issued.status });
    }

    const pdf = await buildQuotationPdf(issued.data);
    if (parsed.value.delivery === "email" && parsed.value.email) {
      try {
        await sendQuotationEmail(issued.data, pdf, parsed.value.email);
        await markBagQuotationEmailed(issued.id, parsed.value.email);
      } catch (err) {
        const fail = emailFailure(err);
        return NextResponse.json(
          { error: fail.error, code: fail.code, id: issued.id, token: issued.token },
          { status: fail.status },
        );
      }
      return NextResponse.json({ ok: true, id: issued.id, token: issued.token });
    }

    return pdfResponse(pdf, issued.id, issued.token);
  } catch (err) {
    if (err instanceof CartResolveError) {
      return NextResponse.json({ error: escapeHtml(err.message), code: "cart" }, { status: err.status });
    }
    console.error("quotation", err);
    return NextResponse.json({ error: "Could not create the quotation.", code: "failed" }, { status: 500 });
  }
}
