import "server-only";

import { buildCouponPdf, couponFilename } from "@/lib/coupon-pdf";
import { escapeHtml } from "@/lib/html-escape";
import { metaSiteUrl } from "@/lib/meta/site";
import {
  couponStatus,
  couponUrl,
  loadCouponForLead,
  unsubscribeUrl,
  type OpeningCoupon,
  type OpeningLead,
} from "@/lib/opening";
import { COUPON_RATE, COUPON_VALID_LABEL, OPENING_DAY_LABEL, STORE_LINE, STORE_WHATSAPP } from "@/lib/opening-options";
import { sendEmail } from "@/lib/resend-pdf";
import { createAdminClient } from "@/lib/supabase/admin";

export const OPENING_EMAIL_KINDS = ["coupon", "xmas", "tomorrow", "open_today", "halfway", "last_days"] as const;
export type OpeningEmailKind = (typeof OPENING_EMAIL_KINDS)[number];

/** Reminder days (Windhoek date) and whether they only go to people who haven't used the coupon. */
const SCHEDULE: { kind: Exclude<OpeningEmailKind, "coupon">; date: string; unusedOnly: boolean }[] = [
  { kind: "xmas", date: "2026-12-20", unusedOnly: false },
  { kind: "tomorrow", date: "2027-01-04", unusedOnly: false },
  { kind: "open_today", date: "2027-01-05", unusedOnly: true },
  { kind: "halfway", date: "2027-01-15", unusedOnly: true },
  { kind: "last_days", date: "2027-01-28", unusedOnly: true },
];

/** Resend's free plan sends about 100 emails a day, shared with order emails. */
export const REMINDERS_PER_RUN = 80;

export function windhoekDate(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Windhoek" }).format(now);
}

/** The reminder that is due on this date, if any. Missed days catch up until the next reminder starts. */
export function dueReminder(now = new Date()) {
  const today = windhoekDate(now);
  let due: (typeof SCHEDULE)[number] | null = null;
  for (const s of SCHEDULE) if (s.date <= today) due = s;
  return due && today <= "2027-01-31" ? due : null;
}

type Content = { subject: string; preheader: string; title: string; lead: string; body: string[]; attach: boolean };

function content(kind: OpeningEmailKind, first: string): Content {
  const hi = `Hi ${first},`;
  switch (kind) {
    case "coupon":
      return {
        subject: `Your ${COUPON_RATE}% opening coupon is here`,
        preheader: `Valid ${COUPON_VALID_LABEL}, in store or online.`,
        title: `Your ${COUPON_RATE}% coupon`,
        lead: hi,
        body: [
          `Thanks for telling us what you'd like in our new store. Here is your personal <strong>${COUPON_RATE}% off coupon</strong>, valid <strong>${COUPON_VALID_LABEL}</strong> in store or online.`,
          `Our Walvis Bay store opens on <strong>${OPENING_DAY_LABEL}</strong>. Show the QR code at the till, or type the code at checkout online. The PDF is attached, and you can keep it on your phone with the button below.`,
        ],
        attach: true,
      };
    case "xmas":
      return {
        subject: `Christmas is coming. Your ${COUPON_RATE}% is waiting for January`,
        preheader: `Your opening coupon works from 5 January.`,
        title: "See you in January",
        lead: hi,
        body: [
          `Merry Christmas from the RAPPI Sports Hub team. Your <strong>${COUPON_RATE}% coupon</strong> is ready for our store opening on <strong>${OPENING_DAY_LABEL}</strong>.`,
          "Planning back-to-school shoes or new boots for the season? Bring your coupon and get them for less.",
        ],
        attach: false,
      };
    case "tomorrow":
      return {
        subject: "Tomorrow we open!",
        preheader: `Doors open ${OPENING_DAY_LABEL}. Bring your ${COUPON_RATE}% coupon.`,
        title: "Tomorrow we open!",
        lead: hi,
        body: [
          `Our Walvis Bay store opens <strong>tomorrow, ${OPENING_DAY_LABEL}</strong>. Your <strong>${COUPON_RATE}% coupon</strong> becomes active at midnight.`,
          `Questions or directions? WhatsApp us on ${STORE_WHATSAPP}.`,
        ],
        attach: false,
      };
    case "open_today":
      return {
        subject: `We're open today. Your ${COUPON_RATE}% coupon is active`,
        preheader: "Show the QR code at the till, or use the code online.",
        title: "We're open!",
        lead: hi,
        body: [
          `RAPPI Sports Hub is <strong>open today</strong> in Walvis Bay, and your <strong>${COUPON_RATE}% coupon is active</strong>. We've attached it again so it's easy to find.`,
          `It's valid until <strong>31 January</strong>, in store or online.`,
        ],
        attach: true,
      };
    case "halfway":
      return {
        subject: `Your ${COUPON_RATE}% is still waiting`,
        preheader: "Half of January gone. Your coupon is valid until 31 January.",
        title: "Still yours to use",
        lead: hi,
        body: [
          `You haven't used your <strong>${COUPON_RATE}% opening coupon</strong> yet. It's valid until <strong>31 January</strong>, in store or online.`,
          "New stock is in for the season: boots, running shoes, school shoes and team kits.",
        ],
        attach: false,
      };
    case "last_days":
      return {
        subject: `3 days left on your ${COUPON_RATE}%`,
        preheader: "Your opening coupon ends on 31 January.",
        title: "3 days left",
        lead: hi,
        body: [
          `Your <strong>${COUPON_RATE}% opening coupon</strong> ends on <strong>31 January</strong>. Use it in store or online before then.`,
        ],
        attach: false,
      };
  }
}

function render(kind: OpeningEmailKind, lead: OpeningLead, coupon: OpeningCoupon) {
  const first = lead.name.trim().split(/\s+/)[0] || "there";
  const c = content(kind, escapeHtml(first));
  const site = metaSiteUrl();
  const link = couponUrl(coupon.code);
  const unsub = unsubscribeUrl(lead.id);
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(c.subject)}</title></head>
<body style="margin:0;padding:0;background:#f4f4f4">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(c.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;font-family:Arial,Helvetica,sans-serif;color:#111111">
<tr><td style="padding:20px 24px;border-bottom:3px solid #5eff38"><img src="${site}/brand/logo-dark.png" alt="RAPPI Sports Hub" width="140" style="display:block;height:auto;border:0" /></td></tr>
<tr><td style="background:#0c110b;padding:26px 24px;text-align:center">
<p style="margin:0;font-size:12px;letter-spacing:3px;font-weight:bold;color:#5eff38;text-transform:uppercase">Store opening · ${escapeHtml(OPENING_DAY_LABEL)}</p>
<h1 style="margin:8px 0 0;font-size:30px;line-height:34px;color:#ffffff;text-transform:uppercase">${escapeHtml(c.title)}</h1>
<p style="margin:14px 0 0"><span style="display:inline-block;background:#5eff38;color:#0c110b;font-weight:bold;font-size:22px;padding:6px 14px;border-radius:8px">${COUPON_RATE}% OFF</span></p>
<p style="margin:12px 0 0;font-family:Menlo,Consolas,monospace;font-size:18px;letter-spacing:3px;color:#ffffff;font-weight:bold">${coupon.code}</p>
</td></tr>
<tr><td style="padding:24px">
<p style="margin:0 0 14px;font-size:15px;line-height:22px">${c.lead}</p>
${c.body.map((p) => `<p style="margin:0 0 14px;font-size:15px;line-height:22px">${p}</p>`).join("\n")}
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:6px 0 20px"><tr><td style="background:#111111;border-radius:999px">
<a href="${link}" style="display:inline-block;padding:13px 26px;font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none">Open my coupon &rarr;</a>
</td></tr></table>
<p style="margin:0;font-size:15px;line-height:22px">See you soon,<br /><strong>The RAPPI Sports Hub team</strong></p>
</td></tr>
<tr><td style="padding:16px 24px;background:#fafafa;border-top:1px solid #e3e3e3;font-size:12px;line-height:18px;color:#5a5a5a">
${escapeHtml(STORE_LINE)} · WhatsApp ${STORE_WHATSAPP} · <a href="${site}" style="color:#111111">rappisportshub.com</a><br /><br />
You're receiving this because you signed up for our store opening coupon. <a href="${unsub}" style="color:#111111">Unsubscribe</a>.
</td></tr></table></td></tr></table></body></html>`;
  const strip = (h: string) => h.replace(/<[^>]+>/g, "");
  const text = [
    c.lead.replace(/&#39;/g, "'"),
    "",
    ...c.body.map((p) => strip(p) + "\n"),
    `Your code: ${coupon.code} (${COUPON_RATE}% off, valid ${COUPON_VALID_LABEL})`,
    `Open your coupon: ${link}`,
    "",
    `${STORE_LINE} · WhatsApp ${STORE_WHATSAPP}`,
    `Unsubscribe: ${unsub}`,
  ].join("\n");
  return { subject: c.subject, html, text, attach: c.attach, unsub };
}

/**
 * Sends one opening email to a lead. Each kind goes once per lead (claimed in
 * opening_emails first); `resend` lets the coupon email go again when the same
 * person signs up twice.
 */
export async function sendOpeningEmail(leadId: string, kind: OpeningEmailKind, opts: { resend?: boolean } = {}) {
  const found = await loadCouponForLead(leadId);
  if (!found) throw new Error("No coupon for this lead.");
  const { lead, coupon } = found;
  if (kind !== "coupon" && (lead.unsubscribed_at || !lead.marketing_consent)) return "skipped" as const;

  const admin = createAdminClient();
  if (!opts.resend) {
    const { error: claimError } = await admin.from("opening_emails").insert({ lead_id: leadId, kind });
    if (claimError) {
      if (claimError.code === "23505") return "already" as const;
      throw new Error(claimError.message);
    }
  }

  const r = render(kind, lead, coupon);
  try {
    const attachments = r.attach
      ? [{ filename: couponFilename(coupon.code), content: await buildCouponPdf(coupon, lead) }]
      : undefined;
    await sendEmail({
      to: lead.email,
      subject: r.subject,
      html: r.html,
      text: r.text,
      attachments,
      headers: { "List-Unsubscribe": `<${r.unsub}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
    });
    if (!opts.resend) {
      await admin.from("opening_emails").update({ sent_at: new Date().toISOString(), error: null }).eq("lead_id", leadId).eq("kind", kind);
    }
    return "sent" as const;
  } catch (err) {
    const message = err instanceof Error ? err.message.slice(0, 300) : "send failed";
    if (!opts.resend) {
      await admin.from("opening_emails").update({ error: message }).eq("lead_id", leadId).eq("kind", kind);
    }
    throw err;
  }
}

/** Daily: sends the reminder due today to everyone who hasn't had it, up to the per-run cap. */
export async function sendOpeningReminders(now = new Date()) {
  const due = dueReminder(now);
  if (!due) return { kind: null, sent: 0, remaining: 0 };
  const admin = createAdminClient();
  const [{ data: leads, error }, { data: done, error: doneError }] = await Promise.all([
    admin
      .from("opening_leads")
      .select("id, opening_coupons(redeemed_at, valid_from, valid_until)")
      .eq("marketing_consent", true)
      .is("unsubscribed_at", null)
      .order("created_at"),
    admin.from("opening_emails").select("lead_id").eq("kind", due.kind),
  ]);
  if (error) throw new Error(error.message);
  if (doneError) throw new Error(doneError.message);
  const already = new Set((done ?? []).map((d) => d.lead_id));
  const todo = (leads ?? []).filter((l) => {
    if (already.has(l.id)) return false;
    const c = (l.opening_coupons as unknown as Pick<OpeningCoupon, "redeemed_at" | "valid_from" | "valid_until">[] | null)?.[0]
      ?? (l.opening_coupons as unknown as Pick<OpeningCoupon, "redeemed_at" | "valid_from" | "valid_until"> | null);
    if (!c) return false;
    if (couponStatus(c, now.getTime()) === "expired") return false;
    return !(due.unusedOnly && c.redeemed_at);
  });
  let sent = 0;
  for (const l of todo.slice(0, REMINDERS_PER_RUN)) {
    try {
      if ((await sendOpeningEmail(l.id, due.kind)) === "sent") sent++;
    } catch (err) {
      console.error("opening reminder", due.kind, err instanceof Error ? err.message : err);
    }
  }
  return { kind: due.kind, sent, remaining: Math.max(0, todo.length - REMINDERS_PER_RUN) };
}
