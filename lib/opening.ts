import "server-only";

import { createHash, createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { metaSiteUrl } from "@/lib/meta/site";
import {
  BUYS_FOR,
  DRAWS,
  MAX_DRAWS,
  MAX_WANTS,
  ORG_SIZES,
  SPEND,
  SPORTS,
  TOWNS,
  WANTS,
  needsOrgStep,
  type OpeningAnswers,
} from "@/lib/opening-options";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/database.types";

export type OpeningLead = Database["public"]["Tables"]["opening_leads"]["Row"];
export type OpeningCoupon = Database["public"]["Tables"]["opening_coupons"]["Row"];
export type CouponStatus = "not_active" | "valid" | "used" | "expired";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const COUPON_CODE = /^RSH-OPEN-[A-Z0-9]{6}$/;

export function newCouponCode() {
  let out = "";
  for (let i = 0; i < 6; i++) out += ALPHABET[randomInt(ALPHABET.length)];
  return `RSH-OPEN-${out}`;
}

export function normalizeCouponCode(raw: unknown) {
  return String(raw ?? "").trim().toUpperCase().replace(/\s+/g, "");
}

export function couponUrl(code: string) {
  return `${metaSiteUrl()}/c/${code}`;
}

export function couponStatus(c: Pick<OpeningCoupon, "redeemed_at" | "valid_from" | "valid_until">, now = Date.now()): CouponStatus {
  if (c.redeemed_at) return "used";
  if (now < Date.parse(c.valid_from)) return "not_active";
  if (now >= Date.parse(c.valid_until)) return "expired";
  return "valid";
}

/** Namibian numbers: "081 234 5678" and "+264 81 234 5678" both become 264812345678. */
export function normalizeWhatsapp(raw: unknown) {
  let d = String(raw ?? "").replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("0")) {
    // A local number is exactly 10 digits, e.g. 081 234 5678.
    if (d.length !== 10) return "";
    d = `264${d.slice(1)}`;
  }
  if (d.length === 9 && /^[68]/.test(d)) d = `264${d}`;
  return /^[0-9]{7,15}$/.test(d) ? d : "";
}

export function maskWhatsapp(d: string) {
  const local = d.startsWith("264") ? `0${d.slice(3)}` : d;
  return local.length > 6 ? `${local.slice(0, 3)} ••• ${local.slice(-4)}` : local;
}

export function firstNameInitial(name: string) {
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0]}.` : parts[0];
}

function signingKey() {
  const own = process.env.DOCUMENT_VERIFY_SECRET?.trim();
  if (own) return own;
  const base = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!base) throw new Error("DOCUMENT_VERIFY_SECRET is not set.");
  return createHmac("sha256", base).update("rappi-document-verify-v1").digest("hex");
}

function sign(purpose: string, value: string) {
  return createHmac("sha256", signingKey()).update(`${purpose}:${value}`).digest("base64url").slice(0, 32);
}

function sameText(a: string, b: string) {
  const x = createHash("sha256").update(a).digest();
  const y = createHash("sha256").update(b).digest();
  return timingSafeEqual(x, y);
}

export function unsubscribeUrl(leadId: string) {
  return `${metaSiteUrl()}/opening/unsubscribe?l=${leadId}&t=${sign("unsub", leadId)}`;
}

export function checkUnsubscribe(leadId: string, token: string) {
  return /^[0-9a-f-]{36}$/.test(leadId) && sameText(sign("unsub", leadId), token);
}

// --- Till PIN (store staff) ---------------------------------------------------

export const STAFF_COOKIE = "rsh_till";
const STAFF_HOURS = 12;

export function tillPinMatches(pin: string) {
  const want = process.env.COUPON_TILL_PIN?.trim();
  if (!want) return false;
  return sameText(want, pin.trim());
}

/** Cookie value "<staff>|<expires>|<sig>" so the till phone needn't retype the PIN all day. */
export function staffCookieValue(staff: string, now = Date.now()) {
  const exp = String(now + STAFF_HOURS * 3600_000);
  const who = staff.replace(/\|/g, " ").trim().slice(0, 40);
  return `${encodeURIComponent(who)}|${exp}|${sign("till", `${who}|${exp}|${process.env.COUPON_TILL_PIN ?? ""}`)}`;
}

export function staffFromCookie(value: string | undefined, now = Date.now()) {
  if (!value) return null;
  const [rawWho, exp, sig] = value.split("|");
  if (!rawWho || !exp || !sig || Number(exp) < now) return null;
  const who = decodeURIComponent(rawWho);
  return sameText(sign("till", `${who}|${exp}|${process.env.COUPON_TILL_PIN ?? ""}`), sig) ? who : null;
}

export const staffCookieMaxAge = STAFF_HOURS * 3600;

// --- Answers ------------------------------------------------------------------

const pick = (allowed: readonly string[], value: unknown, max = Infinity) =>
  (Array.isArray(value) ? value : []).map(String).filter((v) => allowed.includes(v)).slice(0, max);
const one = (allowed: readonly string[], value: unknown) => (allowed.includes(String(value)) ? String(value) : "");
const text = (value: unknown, max: number) => String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);

export type ParsedAnswers = { ok: true; value: OpeningAnswers } | { ok: false; error: string };

export function parseAnswers(body: unknown): ParsedAnswers {
  if (!body || typeof body !== "object") return { ok: false, error: "Invalid request." };
  const b = body as Record<string, unknown>;
  const name = text(b.name, 80);
  const email = text(b.email, 160).toLowerCase();
  const whatsapp = normalizeWhatsapp(b.whatsapp);
  const town = one(TOWNS, b.town);
  if (name.length < 2) return { ok: false, error: "Enter your full name." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: "Enter a valid email." };
  if (!whatsapp) return { ok: false, error: "Enter a valid WhatsApp number." };
  if (!town) return { ok: false, error: "Choose where you live." };
  if (b.marketingConsent !== true) return { ok: false, error: "Tick the box to receive your coupon and offers." };
  if (b.privacyConsent !== true) return { ok: false, error: "Please agree to the privacy policy." };
  const buysFor = pick(BUYS_FOR, b.buysFor);
  const org = needsOrgStep(buysFor);
  return {
    ok: true,
    value: {
      name,
      email,
      whatsapp,
      town,
      sports: pick(SPORTS, b.sports),
      buysFor,
      wants: pick(WANTS, b.wants, MAX_WANTS),
      spend: one(SPEND, b.spend),
      wishCode: text(b.wishCode, 40),
      draws: pick(DRAWS, b.draws, MAX_DRAWS),
      orgName: org ? text(b.orgName, 120) : "",
      orgRole: org ? text(b.orgRole, 80) : "",
      orgSize: org ? one(ORG_SIZES, b.orgSize) : "",
      notes: text(b.notes, 500),
      marketingConsent: true,
      privacyConsent: true,
    },
  };
}

// --- Storage ------------------------------------------------------------------

export async function loadCoupon(code: string) {
  if (!COUPON_CODE.test(code)) return null;
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("opening_coupons")
    .select("*, opening_leads(*)")
    .eq("code", code)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const { opening_leads: lead, ...coupon } = data as OpeningCoupon & { opening_leads: OpeningLead };
  return { coupon, lead };
}

export async function loadCouponForLead(leadId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin.from("opening_coupons").select("code").eq("lead_id", leadId).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? loadCoupon(data.code) : null;
}

/**
 * Saves a new lead and its coupon, or returns the existing coupon when the
 * email or WhatsApp number already signed up (one coupon per person).
 */
export async function saveLead(a: OpeningAnswers): Promise<{ code: string; created: boolean }> {
  const admin = createAdminClient();
  // Two plain lookups (not a PostgREST `or` string) so user text never becomes filter syntax.
  const byEmail = await admin.from("opening_leads").select("id").eq("email", a.email).maybeSingle();
  if (byEmail.error) throw new Error(byEmail.error.message);
  const byPhone = byEmail.data
    ? byEmail
    : await admin.from("opening_leads").select("id").eq("whatsapp", a.whatsapp).maybeSingle();
  if (byPhone.error) throw new Error(byPhone.error.message);
  const existing = byEmail.data ?? byPhone.data;
  if (existing) {
    const found = await loadCouponForLead(existing.id);
    if (found) return { code: found.coupon.code, created: false };
  }

  const { data: lead, error } = await admin
    .from("opening_leads")
    .insert({
      name: a.name,
      email: a.email,
      whatsapp: a.whatsapp,
      town: a.town,
      sports: a.sports,
      buys_for: a.buysFor,
      wants: a.wants,
      spend: a.spend || null,
      wish_code: a.wishCode || null,
      draws: a.draws,
      org_name: a.orgName || null,
      org_role: a.orgRole || null,
      org_size: a.orgSize || null,
      notes: a.notes || null,
      marketing_consent: a.marketingConsent,
      privacy_consent: a.privacyConsent,
    })
    .select("id")
    .single();
  if (error) {
    // Two submits at once: the unique index wins; hand back the first coupon.
    if (error.code === "23505") return saveLead(a);
    throw new Error(error.message);
  }
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = newCouponCode();
    const { error: couponError } = await admin.from("opening_coupons").insert({ code, lead_id: lead.id });
    if (!couponError) return { code, created: true };
    if (couponError.code !== "23505") throw new Error(couponError.message);
  }
  throw new Error("Could not create a coupon code.");
}

/** Marks a coupon used once; false when it was already used, not active or expired. */
export async function redeemCoupon(code: string, by: string, channel: "store" | "online", orderId?: string, now = new Date()) {
  const admin = createAdminClient();
  const iso = now.toISOString();
  const { data, error } = await admin
    .from("opening_coupons")
    .update({ redeemed_at: iso, redeemed_by: by.slice(0, 40), redeemed_channel: channel, order_id: orderId ?? null })
    .eq("code", code)
    .is("redeemed_at", null)
    .lte("valid_from", iso)
    .gt("valid_until", iso)
    .select("code")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return Boolean(data);
}
