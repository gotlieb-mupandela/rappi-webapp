import "server-only";

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { surtidoSizeText } from "@/lib/assortment";
import {
  mergeCheckoutLineRequests,
  parseCheckoutLineInput,
  priceCheckoutLines,
} from "@/lib/checkout-lines";
import type { Json } from "@/lib/database.types";
import type { QuotationPdfData, QuotationPdfItem } from "@/lib/quotation-pdf";
import { sizeDisplayLabel } from "@/lib/product-stock";
import { createAdminClient } from "@/lib/supabase/admin";
import { getFreshCheckoutProducts } from "@/lib/supabase/catalog";
import { roundMoney } from "@/lib/vat";

const QUOTE_ID = /^Q-[0-9]{6}-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/;
const TOKEN_HASH = /^[0-9a-f]{64}$/;
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export type IssueBagQuotationInput = {
  lines: unknown;
  email?: string;
  quoteId?: string;
  token?: string;
};

export type IssueBagQuotationResult =
  | {
      ok: true;
      id: string;
      token: string;
      created: boolean;
      data: QuotationPdfData;
    }
  | {
      ok: false;
      status: number;
      error: string;
      code: "not_found" | "failed";
    };

type StoredQuote = {
  id: string;
  created_at: string;
  email: string | null;
  subtotal: number | string;
  items: Json;
  token: string;
};

function clip(value: string, max: number) {
  return value.trim().slice(0, max);
}

export function newQuoteId(now = new Date()) {
  const yy = String(now.getUTCFullYear()).slice(-2);
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(now.getUTCDate()).padStart(2, "0");
  const bytes = randomBytes(8);
  let suffix = "";
  for (let i = 0; i < 8; i++) suffix += ALPHABET[bytes[i]! % ALPHABET.length];
  return `Q-${yy}${mm}${dd}-${suffix}`;
}

export function newQuoteToken() {
  return randomBytes(32).toString("base64url");
}

export function hashQuoteToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function quoteTokensMatch(storedHash: string, token: string) {
  if (!TOKEN_HASH.test(storedHash)) return false;
  const actual = Buffer.from(hashQuoteToken(token));
  const expected = Buffer.from(storedHash);
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

function readItems(value: Json): QuotationPdfItem[] | null {
  if (!Array.isArray(value) || !value.length) return null;
  const items: QuotationPdfItem[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    const row = raw as Record<string, Json | undefined>;
    const { code, name, sizeLabel, qty, unitPrice, lineTotal } = row;
    if (
      typeof code !== "string" ||
      typeof name !== "string" ||
      typeof sizeLabel !== "string" ||
      typeof qty !== "number" ||
      typeof unitPrice !== "number" ||
      typeof lineTotal !== "number"
    ) {
      return null;
    }
    if (!code || !name || !(qty > 0) || !(unitPrice > 0)) return null;
    items.push({ code, name, sizeLabel, qty, unitPrice, lineTotal });
  }
  return items;
}

function pdfData(row: StoredQuote, email: string | null): QuotationPdfData | null {
  const items = readItems(row.items);
  const subtotal = Number(row.subtotal);
  if (!items || !Number.isFinite(subtotal) || subtotal <= 0) return null;
  return {
    id: row.id,
    createdAt: row.created_at,
    email,
    items,
    subtotal,
  };
}

async function loadQuote(id: string, token: string, email?: string): Promise<IssueBagQuotationResult> {
  if (!QUOTE_ID.test(id)) {
    return { ok: false, status: 404, error: "Quotation not found.", code: "not_found" };
  }
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("bag_quotations")
    .select("id, created_at, email, subtotal, items, token")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    console.error("quotation load", error.message);
    return { ok: false, status: 500, error: "Could not create the quotation.", code: "failed" };
  }
  if (!data || !quoteTokensMatch(data.token, token)) {
    return { ok: false, status: 404, error: "Quotation not found.", code: "not_found" };
  }
  const nextEmail = email ?? data.email;
  const built = pdfData(data, nextEmail);
  if (!built) {
    console.error("quotation load", `stored items for ${id} are invalid`);
    return { ok: false, status: 500, error: "Could not create the quotation.", code: "failed" };
  }
  return { ok: true, id: data.id, token, created: false, data: built };
}

async function priceBag(lines: unknown, email?: string) {
  const parsed = parseCheckoutLineInput(lines);
  const merged = mergeCheckoutLineRequests(parsed);
  const products = await getFreshCheckoutProducts(merged.map((line) => line.code));
  const priced = priceCheckoutLines(merged, products);
  const items: QuotationPdfItem[] = priced.map((line) => {
    const product = products.get(line.code);
    const sizeLabel = product
      ? surtidoSizeText(product, line.size) ?? sizeDisplayLabel(line.size)
      : sizeDisplayLabel(line.size);
    return {
      code: clip(line.code, 40),
      name: clip(line.name, 180),
      sizeLabel: clip(sizeLabel, 80),
      qty: line.qty,
      unitPrice: line.price,
      lineTotal: roundMoney(line.price * line.qty),
    };
  });
  const subtotal = roundMoney(items.reduce((sum, item) => sum + item.lineTotal, 0));
  const itemCount = items.reduce((sum, item) => sum + item.qty, 0);
  return { items, subtotal, itemCount, email: email ?? null };
}

export async function issueBagQuotation(input: IssueBagQuotationInput): Promise<IssueBagQuotationResult> {
  if (input.quoteId || input.token) {
    if (!input.quoteId || !input.token) {
      return { ok: false, status: 404, error: "Quotation not found.", code: "not_found" };
    }
    return loadQuote(input.quoteId, input.token, input.email);
  }

  const priced = await priceBag(input.lines, input.email);
  const admin = createAdminClient();
  for (let attempt = 0; attempt < 5; attempt++) {
    const id = newQuoteId();
    const token = newQuoteToken();
    const { data, error } = await admin
      .from("bag_quotations")
      .insert({
        id,
        email: priced.email,
        subtotal: priced.subtotal,
        currency: "NAD",
        item_count: priced.itemCount,
        items: priced.items as Json,
        token: hashQuoteToken(token),
      })
      .select("id, created_at")
      .single();
    if (error) {
      if (error.code === "23505") continue;
      console.error("quotation insert", error.message);
      return { ok: false, status: 500, error: "Could not create the quotation.", code: "failed" };
    }
    return {
      ok: true,
      id: data.id,
      token,
      created: true,
      data: {
        id: data.id,
        createdAt: data.created_at,
        email: priced.email,
        items: priced.items,
        subtotal: priced.subtotal,
      },
    };
  }
  return { ok: false, status: 500, error: "Could not create the quotation.", code: "failed" };
}

export async function markBagQuotationEmailed(id: string, email: string) {
  const admin = createAdminClient();
  const { error } = await admin
    .from("bag_quotations")
    .update({ email, emailed_at: new Date().toISOString() })
    .eq("id", id);
  if (error) console.error("quotation emailed_at", error.message);
}
