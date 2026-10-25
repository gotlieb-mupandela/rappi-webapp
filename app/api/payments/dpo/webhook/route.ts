import { timingSafeEqual } from "node:crypto";
import { fulfillDpoPayment } from "@/lib/dpo-payments";
import { xmlTag } from "@/lib/dpo";

export const runtime = "nodejs";

const OK_XML = `<?xml version="1.0" encoding="utf-8"?><API3G><Response>OK</Response></API3G>`;

function secretsMatch(provided: string, expected: string) {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && a.length > 0 && timingSafeEqual(a, b);
}

function authorized(req: Request) {
  const expected = process.env.DPO_WEBHOOK_SECRET?.trim() ?? "";
  if (!expected) return false;
  const url = new URL(req.url);
  const query = url.searchParams.get("token") ?? "";
  const header = req.headers.get("authorization") ?? "";
  const bearer = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
  const custom = req.headers.get("x-dpo-secret") ?? "";
  return secretsMatch(query, expected) || secretsMatch(bearer, expected) || secretsMatch(custom, expected);
}

export async function POST(req: Request) {
  if (!authorized(req)) {
    return new Response(OK_XML, {
      status: 401,
      headers: { "Content-Type": "application/xml; charset=utf-8" },
    });
  }

  const xml = await req.text();
  const transToken = xmlTag(xml, "TransactionToken") ?? xmlTag(xml, "TransToken");
  const companyRef = xmlTag(xml, "CompanyRef");

  if (transToken || companyRef) {
    try {
      await fulfillDpoPayment({ transToken, companyRef });
    } catch {
      // Always acknowledge so DPO does not retry a poison payload.
    }
  }

  return new Response(OK_XML, {
    status: 200,
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
}
