import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { invoiceSeller } from "@/lib/invoice-pdf";
import { LAYBY, laybyBalance, laybyCancellation, laybyPlan } from "@/lib/layby";
import { TERMS_ADDRESS, TERMS_COMPANY } from "@/app/terms/terms";

const W = 595.28;
const H = 841.89;
const M = 48;
const INK = rgb(0.1, 0.1, 0.1);
const MUTED = rgb(0.38, 0.38, 0.38);
const RULE = rgb(0.84, 0.84, 0.84);
const LIME = rgb(0.37, 1, 0.22);
const LOGO_FILE = path.join(process.cwd(), "public", "brand", "logo-dark.png");

export type LaybyDocData = {
  layby: {
    id: string;
    order_id: string;
    name: string;
    email: string;
    phone: string | null;
    total: number;
    paid: number;
    opened_at: string;
    final_due_at: string;
    accepted_at: string | null;
    status: string;
  };
  order: { shipping_method: string; shipping_cost: number; vat_rate: number; vat_amount: number; address: string; city: string };
  items: { code: string; name: string; size: string; qty: number; unit_price: number }[];
  payments: { created_at: string; amount: number; method: string; kind: string }[];
};

function safe(v: string) {
  return v
    .replace(/\s*[·•]\s*/g, " - ")
    .replace(/[‐-―−]/g, "-")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, "?");
}
const nad = (n: number) => `N$${Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const day = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Windhoek" }).format(new Date(iso));

function wrap(text: string, font: PDFFont, size: number, width: number) {
  const out: string[] = [];
  let line = "";
  for (const word of safe(text).split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) > width && line) {
      out.push(line);
      line = word;
    } else line = next;
  }
  if (line) out.push(line);
  return out;
}

/** Layby agreement and statement: what was agreed, what's been paid, what's left. */
export async function buildLaybyPdf(d: LaybyDocData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const [regular, bold] = await Promise.all([doc.embedFont(StandardFonts.Helvetica), doc.embedFont(StandardFonts.HelveticaBold)]);
  const logo = await readFile(LOGO_FILE).then((b) => doc.embedPng(b)).catch(() => null);
  const seller = invoiceSeller();
  const plan = laybyPlan(Number(d.layby.total), new Date(d.layby.opened_at));
  const balance = laybyBalance(d.layby);
  const cancel = laybyCancellation({ total: d.layby.total, paid: Number(d.layby.total) });

  let page!: PDFPage;
  let y = 0;
  const right = (t: string, font: PDFFont, size: number, x: number, yy: number, color = INK) =>
    page.drawText(safe(t), { x: x - font.widthOfTextAtSize(safe(t), size), y: yy, size, font, color });
  const newPage = () => {
    page = doc.addPage([W, H]);
    page.drawRectangle({ x: 0, y: H - 96, width: W, height: 3, color: LIME });
    if (logo) page.drawImage(logo, { x: M, y: H - 82, width: 58 * (1416 / 895), height: 58 });
    right("LAYBY AGREEMENT", bold, 16, W - M, H - 44);
    right(`${d.layby.id} · statement ${day(new Date().toISOString())}`.replace("·", "-"), regular, 9, W - M, H - 60, MUTED);
    y = H - 120;
  };
  const need = (h: number) => {
    if (y - h < 60) newPage();
  };
  const text = (t: string, size = 9.5, font = regular, color = INK, x = M, width = W - 2 * M) => {
    for (const l of wrap(t, font, size, width)) {
      need(size + 4);
      page.drawText(l, { x, y, size, font, color });
      y -= size + 4;
    }
  };
  const rule = () => {
    page.drawLine({ start: { x: M, y: y + 4 }, end: { x: W - M, y: y + 4 }, thickness: 0.7, color: RULE });
    y -= 8;
  };
  const title = (t: string) => {
    need(30);
    y -= 6;
    page.drawText(safe(t.toUpperCase()), { x: M, y, size: 10, font: bold, color: INK });
    y -= 6;
    rule();
  };

  newPage();
  // Parties
  const colW = (W - 2 * M) / 2 - 10;
  const top = y;
  text("SELLER", 8, bold, MUTED);
  text(TERMS_COMPANY, 9.5, bold, INK, M, colW);
  text([seller.address, seller.city].filter(Boolean).join(", ") || TERMS_ADDRESS, 9, regular, INK, M, colW);
  text(`${seller.email}${seller.vatNumber ? ` · VAT ${seller.vatNumber}` : ""}`.replace("·", "-"), 9, regular, INK, M, colW);
  const leftEnd = y;
  y = top;
  const cx = M + colW + 20;
  text("CUSTOMER", 8, bold, MUTED, cx, colW);
  text(d.layby.name, 9.5, bold, INK, cx, colW);
  text(d.layby.email, 9, regular, INK, cx, colW);
  if (d.layby.phone) text(d.layby.phone, 9, regular, INK, cx, colW);
  text(`Delivery: ${d.order.shipping_method}${d.order.address && d.order.address !== "Hub pickup" ? ` to ${d.order.address}, ${d.order.city}` : ""}`, 9, regular, INK, cx, colW);
  y = Math.min(y, leftEnd) - 6;

  // Key facts
  title("Layby details");
  const facts: [string, string][] = [
    ["Layby number", d.layby.id],
    ["Order number", d.layby.order_id],
    ["Opened", day(d.layby.opened_at)],
    ["Pay in full by", day(d.layby.final_due_at)],
    ["Total price (fixed)", nad(d.layby.total)],
    ["Deposit (20%)", nad(plan.deposit)],
    ["Suggested monthly payment", `${nad(plan.monthly)} x ${LAYBY.TERM_MONTHS}`],
    ["Paid so far", nad(d.layby.paid)],
    ["Balance to pay", nad(balance)],
    ["Status", d.layby.status === "active" ? "Active" : d.layby.status === "paid" ? "Paid in full" : "Cancelled"],
  ];
  for (const [k, v] of facts) {
    need(15);
    page.drawText(safe(k), { x: M, y, size: 9.5, font: regular, color: MUTED });
    page.drawText(safe(v), { x: M + 170, y, size: 9.5, font: k === "Balance to pay" ? bold : regular, color: INK });
    y -= 15;
  }

  // Items
  title("Goods reserved for you");
  for (const it of d.items) {
    const name = it.name.replace(new RegExp(`\\s*[\\u00b7\\u2022]\\s*${it.code.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`), "");
    need(15);
    page.drawText(safe(it.code), { x: M, y, size: 8.5, font: regular, color: MUTED });
    const lines = wrap(name, regular, 9, 250);
    page.drawText(lines[0] ?? "", { x: M + 80, y, size: 9, font: regular, color: INK });
    page.drawText(safe(it.size || "-"), { x: M + 345, y, size: 9, font: regular, color: INK });
    page.drawText(String(it.qty), { x: M + 400, y, size: 9, font: regular, color: INK });
    right(nad(Number(it.unit_price) * it.qty), regular, 9, W - M, y);
    y -= 14;
    for (const extra of lines.slice(1)) {
      need(12);
      page.drawText(extra, { x: M + 80, y, size: 9, font: regular, color: INK });
      y -= 12;
    }
  }
  const sums: [string, number][] = [
    [d.order.shipping_method || "Delivery", Number(d.order.shipping_cost)],
    [`VAT ${Number(d.order.vat_rate)}%`, Number(d.order.vat_amount)],
    ["Total", Number(d.layby.total)],
  ];
  for (const [k, v] of sums) {
    need(14);
    right(k, k === "Total" ? bold : regular, 9.5, W - M - 90, y, k === "Total" ? INK : MUTED);
    right(nad(v), k === "Total" ? bold : regular, 9.5, W - M, y);
    y -= 14;
  }

  // Payments
  title("Payments received");
  if (!d.payments.length) text("No payments yet.", 9, regular, MUTED);
  for (const p of d.payments) {
    need(14);
    page.drawText(day(p.created_at), { x: M, y, size: 9, font: regular, color: INK });
    page.drawText(safe(`${p.kind === "deposit" ? "Deposit" : "Payment"} (${p.method})`), { x: M + 110, y, size: 9, font: regular, color: INK });
    right(nad(p.amount), regular, 9, W - M, y);
    y -= 14;
  }

  // Terms
  title("Layby terms (Terms and Conditions, clause 7)");
  const terms = [
    `Layby is available on orders of N$${LAYBY.MIN_ORDER} or more. A deposit of 20% of the total is paid when the layby is opened. Promotions, free gifts and discount codes do not apply to layby.`,
    `The price is fixed for ${LAYBY.TERM_MONTHS} months. The balance may be paid in any amounts of at least N$${LAYBY.MIN_PAYMENT} (or the balance, if less), online or in store, and must be paid in full by ${day(d.layby.final_due_at)}.`,
    "The goods remain the property of the Company and are reserved for the Customer. They are packed and sent, or released at the Hub, only once the layby is paid in full and the last payment has cleared.",
    `If the Customer cancels, or does not pay for ${LAYBY.TERM_MONTHS} consecutive months, or the balance is not paid by the final date, the Company may cancel the layby after written notice by email, return the goods to stock and refund the amount paid less an administration fee of 30% of the total price (on this layby ${nad(cancel.fee)}), provided the fee never exceeds the amount paid.`,
    "Refunds are made by the method used to pay. The Terms and Conditions and the Returns Policy at www.rappisportshub.com apply.",
  ];
  for (const [i, t] of terms.entries()) {
    text(`${i + 1}. ${t}`, 9, regular, INK);
    y -= 2;
  }
  y -= 6;
  text(
    d.layby.accepted_at
      ? `Accepted online by ${d.layby.name} (${d.layby.email}) on ${new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Windhoek" }).format(new Date(d.layby.accepted_at))}. Accepting online has the same effect as signing.`
      : "Signed in store.",
    8.5,
    bold,
    INK,
  );

  const pages = doc.getPages();
  pages.forEach((p, i) => p.drawText(`Page ${i + 1} of ${pages.length}`, { x: M, y: 28, size: 8, font: regular, color: MUTED }));
  return doc.save();
}

export function laybyPdfFilename(id: string) {
  return `layby-${id}.pdf`;
}
