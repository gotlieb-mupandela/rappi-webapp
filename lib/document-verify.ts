import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { metaSiteUrl } from "@/lib/meta/site";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const SIG_LENGTH = 6;
const ORDER_ID = /^RSH[0-9A-F]{8}$/;
const QUOTE_ID = /^Q-[0-9]{6}-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/;

export type VerifiableDocument = { kind: "order" | "quote"; id: string };

function signingKey() {
  const own = process.env.DOCUMENT_VERIFY_SECRET?.trim();
  if (own) return own;
  const base = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!base) throw new Error("DOCUMENT_VERIFY_SECRET is not set.");
  return createHmac("sha256", base).update("rappi-document-verify-v1").digest("hex");
}

/** 6 characters; 256 is a multiple of 32, so every character is uniform. */
function signature(id: string) {
  const mac = createHmac("sha256", signingKey()).update(`doc:${id.toUpperCase()}`).digest();
  let out = "";
  for (let i = 0; i < SIG_LENGTH; i++) out += ALPHABET[mac[i] % ALPHABET.length];
  return out;
}

export function documentVerifyCode(id: string) {
  return `${id.toUpperCase()}-${signature(id)}`;
}

export function documentVerifyUrl(id: string) {
  return `${metaSiteUrl()}/verify/${documentVerifyCode(id)}`;
}

export function documentVerifyHost() {
  return metaSiteUrl().replace(/^https?:\/\//, "");
}

export function parseDocumentVerifyCode(raw: string): VerifiableDocument | null {
  const code = raw.trim().toUpperCase().replace(/\s+/g, "");
  const cut = code.lastIndexOf("-");
  if (cut <= 0) return null;
  const id = code.slice(0, cut);
  const given = code.slice(cut + 1);
  const kind = ORDER_ID.test(id) ? "order" : QUOTE_ID.test(id) ? "quote" : null;
  if (!kind || !/^[A-Z0-9]{6}$/.test(given)) return null;
  if (!timingSafeEqual(Buffer.from(signature(id)), Buffer.from(given))) return null;
  return { kind, id };
}
