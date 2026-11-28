import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { ORDER_EMAIL_KINDS, renderLateOrdersDigest, renderOrderEmail, type OrderEmailContext } from "../lib/order-emails";

// Emoji and pictographs (plus the emoji variation selector). Plain symbols like "·", "–" and "→" are fine.
const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{231A}-\u{23FF}\u{FE0F}]/u;

const ctx: OrderEmailContext = {
  siteUrl: "https://www.rappisportshub.com",
  logoUrl: "https://www.rappisportshub.com/brand/logo-dark.png",
  sellerName: "RAPPI Sports Hub",
  contactEmail: "sales@rappisportshub.com",
  contactPhone: "+264 81 814 1646",
  order: {
    id: "RSH1", full_name: "Anna Test", email: "a@example.com", phone: "0811234567", address: "1 Street", city: "Walvis Bay",
    country: "Namibia", shipping_method: "Standard (5–8 days)", shipping_cost: 100, subtotal: 900, total: 1150,
    vat_rate: 15, vat_amount: 150, created_at: "2026-11-30T08:00:00Z", due_at: "2026-12-15T21:59:59Z",
  },
  items: [{ code: "RR600W2691", name: "R.6000 · RR600W2691", size: "40", qty: 1, unit_price: 900 }],
  staff: { photos: {}, gifts: [{ code: "400089.100", name: "Cap", qty: 1, reason: "Black Friday" }], discounts: [], paymentRef: "X", invoiceAttached: true },
};

test("no order email kind contains an emoji", () => {
  for (const kind of ORDER_EMAIL_KINDS) {
    const e = renderOrderEmail(kind, ctx);
    for (const [part, text] of Object.entries(e)) assert.ok(!EMOJI.test(text), `${kind} ${part}: ${text.match(EMOJI)?.[0]}`);
  }
  const digest = renderLateOrdersDigest(
    [{ id: "RSH1", full_name: "A", shipping_method: "Standard", status: "reserved", total: 10, due_at: "2026-12-01T00:00:00Z" }],
    { ...ctx, order: ctx.order } as never,
    new Date("2026-12-02T00:00:00Z"),
  ) as unknown as Record<string, string>;
  for (const text of Object.values(digest)) if (typeof text === "string") assert.ok(!EMOJI.test(text));
});

test("no email or PDF source file contains an emoji", () => {
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const f of readdirSync(dir)) {
      const p = path.join(dir, f);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(ts|tsx)$/.test(f)) files.push(p);
    }
  };
  walk(path.join(__dirname, "..", "lib"));
  const emailish = files.filter((f) => /email|notify|layby-server|opening|pdf|resend/i.test(f));
  assert.ok(emailish.length > 8, String(emailish.length));
  for (const f of emailish) {
    const lines = readFileSync(f, "utf8").split("\n");
    lines.forEach((l, i) => assert.ok(!EMOJI.test(l), `${path.relative(process.cwd(), f)}:${i + 1}: ${l.trim().slice(0, 80)}`));
  }
});
