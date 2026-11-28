import { readFile } from "node:fs/promises";
import path from "node:path";
import type { BlackFridayOffer } from "@/lib/black-friday";
import { documentOffer } from "@/lib/black-friday-documents";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/database.types";
import { PDF_PHOTO_COLUMN, PDF_PHOTO_SIZE, drawItemPhoto, embedItemPhotos } from "@/lib/pdf-item-photos";
import { VERIFY_BOX_HEIGHT, drawVerifyBox } from "@/lib/pdf-verify-box";
import { contactEmail } from "@/lib/site-contact";

type OrderRow = Database["public"]["Tables"]["orders"]["Row"];
type OrderItemRow = Database["public"]["Tables"]["order_items"]["Row"];

export type InvoiceData = {
  order: OrderRow;
  items: OrderItemRow[];
  paymentRef: string | null;
};

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 48;
const HEADER_HEIGHT = 96;
const INK = rgb(0.1, 0.1, 0.1);
const MUTED = rgb(0.35, 0.35, 0.35);
const RULE = rgb(0.82, 0.82, 0.82);
const HEADER_BG = rgb(1, 1, 1);
const LIME = rgb(0.37, 1, 0.22);
const FREE_GREEN = rgb(0.18, 0.54, 0.07);
const LOGO_FILE = path.join(process.cwd(), "public", "brand", "logo-dark.png");
const LOGO_NATIVE_WIDTH = 1416;
const LOGO_NATIVE_HEIGHT = 895;

function envText(name: string) {
  return (process.env[name] || "").trim();
}

export function invoiceSeller() {
  return {
    legalName: envText("INVOICE_LEGAL_NAME") || "RAPPI Sports Hub",
    address: envText("INVOICE_ADDRESS"),
    city: envText("INVOICE_CITY"),
    vatNumber: envText("INVOICE_VAT_NUMBER"),
    email: contactEmail(),
  };
}

export function invoiceFilename(orderId: string) {
  return `invoice-${orderId}.pdf`;
}

export function formatInvoiceMoney(value: number) {
  const n = new Intl.NumberFormat("en-NA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);
  return `N$${n}`;
}

export function formatInvoiceDate(iso: string) {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(new Date(iso));
}

export async function loadInvoiceData(orderId: string): Promise<InvoiceData | null> {
  const admin = createAdminClient();
  const [{ data: order }, { data: items }, { data: payment }] = await Promise.all([
    admin.from("orders").select("*").eq("id", orderId).maybeSingle(),
    admin.from("order_items").select("*").eq("order_id", orderId).order("code"),
    admin
      .from("payments")
      .select("company_ref")
      .eq("order_id", orderId)
      .eq("status", "paid")
      .order("paid_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (!order) return null;
  return {
    order,
    items: items ?? [],
    paymentRef: payment?.company_ref ?? null,
  };
}

function pdfSafe(value: string) {
  return value
    .replace(/\s*[\u00b7\u2022]\s*/g, " - ")
    .replace(/[\u2010-\u2015\u2212]/g, "-")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, "?");
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number) {
  const words = pdfSafe(text).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) <= maxWidth) {
      current = next;
      continue;
    }
    if (current) lines.push(current);
    if (font.widthOfTextAtSize(word, size) <= maxWidth) {
      current = word;
      continue;
    }
    let chunk = "";
    for (const ch of word) {
      const trial = chunk + ch;
      if (font.widthOfTextAtSize(trial, size) <= maxWidth) {
        chunk = trial;
      } else {
        if (chunk) lines.push(chunk);
        chunk = ch;
      }
    }
    current = chunk;
  }
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

function drawRight(page: PDFPage, text: string, font: PDFFont, size: number, x: number, y: number, color = INK) {
  page.drawText(text, { x: x - font.widthOfTextAtSize(text, size), y, size, font, color });
}

async function embedBrandLogo(doc: PDFDocument) {
  try {
    const bytes = await readFile(LOGO_FILE);
    return await doc.embedPng(bytes);
  } catch (err) {
    console.error("invoice logo", err);
    return null;
  }
}

function drawBrandHeader(page: PDFPage, logo: PDFImage | null, bold: PDFFont) {
  page.drawRectangle({
    x: 0,
    y: PAGE_HEIGHT - HEADER_HEIGHT,
    width: PAGE_WIDTH,
    height: HEADER_HEIGHT,
    color: HEADER_BG,
  });
  page.drawRectangle({
    x: 0,
    y: PAGE_HEIGHT - HEADER_HEIGHT,
    width: PAGE_WIDTH,
    height: 3,
    color: LIME,
  });
  if (logo) {
    const height = 58;
    const width = height * (LOGO_NATIVE_WIDTH / LOGO_NATIVE_HEIGHT);
    page.drawImage(logo, {
      x: MARGIN,
      y: PAGE_HEIGHT - HEADER_HEIGHT + (HEADER_HEIGHT - height) / 2,
      width,
      height,
    });
  }
  drawRight(page, "RECEIPT / TAX INVOICE", bold, 16, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 42, INK);
}

export async function buildInvoicePdf(data: InvoiceData): Promise<Uint8Array> {
  const { order, items, paymentRef } = data;
  const seller = invoiceSeller();
  const doc = await PDFDocument.create();
  const [regular, bold, logo] = await Promise.all([
    doc.embedFont(StandardFonts.Helvetica),
    doc.embedFont(StandardFonts.HelveticaBold),
    embedBrandLogo(doc),
  ]);
  const offer = documentOffer(
    items.map((item) => ({ code: item.code, qty: item.qty, unitPrice: Number(item.unit_price) })),
    order.created_at,
  );
  const photos = await embedItemPhotos(doc, [
    ...items.map((item) => item.code),
    ...offer.gifts.map((gift) => gift.code),
  ]);
  const photoColumn = photos.size ? PDF_PHOTO_COLUMN : 0;

  const cols = {
    photo: MARGIN,
    code: MARGIN + photoColumn,
    name: MARGIN + photoColumn + 78,
    size: PAGE_WIDTH - MARGIN - 178,
    qty: PAGE_WIDTH - MARGIN - 128,
    unit: PAGE_WIDTH - MARGIN - 88,
    amount: PAGE_WIDTH - MARGIN,
  };
  const nameWidth = cols.size - cols.name - 8;

  let page: PDFPage | null = null;
  let y = 0;
  let pageNo = 0;

  const ensureSpace = (needed: number) => {
    if (page && y - needed >= 56) return;
    if (page) {
      page.drawText(`Page ${pageNo}`, {
        x: MARGIN,
        y: 28,
        size: 8,
        font: regular,
        color: MUTED,
      });
    }
    page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    pageNo += 1;
    drawBrandHeader(page, logo, bold);
    y = PAGE_HEIGHT - HEADER_HEIGHT - 20;
    page.drawText(pdfSafe(seller.legalName.toUpperCase()), { x: MARGIN, y, size: 12, font: bold, color: INK });
    y -= 16;

    const sellerLines = [seller.address, seller.city, seller.email].filter(Boolean);
    if (seller.vatNumber) sellerLines.push(`VAT ${seller.vatNumber}`);
    for (const line of sellerLines) {
      page.drawText(pdfSafe(line), { x: MARGIN, y, size: 9, font: regular, color: MUTED });
      y -= 12;
    }

    y -= 8;
    page.drawText(pdfSafe(`Invoice ${order.id}`), { x: MARGIN, y, size: 10, font: bold, color: INK });
    drawRight(page, formatInvoiceDate(order.created_at), regular, 10, PAGE_WIDTH - MARGIN, y);
    y -= 14;
    if (paymentRef) {
      page.drawText(pdfSafe(`Payment ${paymentRef}`), { x: MARGIN, y, size: 9, font: regular, color: MUTED });
      y -= 12;
    }
    page.drawText(pdfSafe(`Shipping: ${order.shipping_method}`), { x: MARGIN, y, size: 9, font: regular, color: MUTED });
    y -= 12;
    if (order.due_at) {
      page.drawText(pdfSafe(`Expected by: ${formatInvoiceDate(order.due_at)}`), { x: MARGIN, y, size: 9, font: regular, color: MUTED });
      y -= 12;
    }
    y -= 6;

    if (pageNo === 1) {
      page.drawText("Bill to", { x: MARGIN, y, size: 9, font: bold, color: MUTED });
      y -= 13;
      const buyer = [
        order.full_name,
        order.email,
        order.phone,
        order.address,
        `${order.city}, ${order.country}`,
      ].filter((line): line is string => Boolean(line));
      for (const line of buyer) {
        page.drawText(pdfSafe(line), { x: MARGIN, y, size: 10, font: regular, color: INK });
        y -= 13;
      }
      y -= 10;
    }

    page.drawLine({
      start: { x: MARGIN, y },
      end: { x: PAGE_WIDTH - MARGIN, y },
      thickness: 0.8,
      color: RULE,
    });
    y -= 16;
    page.drawText("Code", { x: cols.code, y, size: 8, font: bold, color: MUTED });
    page.drawText("Item", { x: cols.name, y, size: 8, font: bold, color: MUTED });
    page.drawText("Size", { x: cols.size, y, size: 8, font: bold, color: MUTED });
    drawRight(page, "Qty", bold, 8, cols.qty + 18, y, MUTED);
    drawRight(page, "Unit", bold, 8, cols.unit + 36, y, MUTED);
    drawRight(page, "Amount", bold, 8, cols.amount, y, MUTED);
    y -= 8;
    page.drawLine({
      start: { x: MARGIN, y },
      end: { x: PAGE_WIDTH - MARGIN, y },
      thickness: 0.6,
      color: RULE,
    });
    y -= 16;
  };

  ensureSpace(220);

  for (const item of items) {
    const nameLines = wrap(item.name.replace(/\s*[\u00b7\u2022]\s*[\w.-]+$/, (m) => (m.replace(/^[\s\u00b7\u2022]+/, "") === item.code ? "" : m)), regular, 9, nameWidth);
    const photo = photos.get(item.code);
    const rowHeight = Math.max(16, nameLines.length * 11 + 6, photoColumn ? PDF_PHOTO_SIZE + 8 : 0);
    ensureSpace(rowHeight);
    const current = page!;
    if (photo) drawItemPhoto(current, photo, cols.photo, y + 9);
    current.drawText(pdfSafe(item.code), { x: cols.code, y, size: 8, font: regular, color: INK });
    current.drawText(pdfSafe(item.size), { x: cols.size, y, size: 9, font: regular, color: INK });
    drawRight(current, String(item.qty), regular, 9, cols.qty + 18, y);
    drawRight(current, formatInvoiceMoney(Number(item.unit_price)), regular, 9, cols.unit + 36, y);
    drawRight(current, formatInvoiceMoney(Number(item.unit_price) * item.qty), regular, 9, cols.amount, y);
    let nameY = y;
    for (const line of nameLines) {
      current.drawText(line, { x: cols.name, y: nameY, size: 9, font: regular, color: INK });
      nameY -= 11;
    }
    y -= rowHeight;
  }

  for (const gift of offer.gifts) {
    const label = `FREE GIFT: ${gift.name}${gift.forCode ? ` (Black Friday, with ${gift.forCode})` : ` (Black Friday, ${gift.reason})`}`;
    const nameLines = wrap(label, bold, 9, nameWidth);
    const photo = photos.get(gift.code);
    const rowHeight = Math.max(16, nameLines.length * 11 + 6, photoColumn ? PDF_PHOTO_SIZE + 8 : 0);
    ensureSpace(rowHeight);
    const current = page!;
    if (photo) drawItemPhoto(current, photo, cols.photo, y + 9);
    current.drawText(pdfSafe(gift.code), { x: cols.code, y, size: 8, font: regular, color: INK });
    drawRight(current, String(gift.qty), regular, 9, cols.qty + 18, y);
    drawRight(current, "FREE", bold, 9, cols.unit + 36, y, FREE_GREEN);
    drawRight(current, "FREE", bold, 9, cols.amount, y, FREE_GREEN);
    let nameY = y;
    for (const line of nameLines) {
      current.drawText(line, { x: cols.name, y: nameY, size: 9, font: bold, color: FREE_GREEN });
      nameY -= 11;
    }
    y -= rowHeight;
  }

  const discountRows = invoiceDiscountRows(order, offer);
  ensureSpace(130 + discountRows.length * 16 + VERIFY_BOX_HEIGHT + 20);
  const totalsPage = page!;
  totalsPage.drawLine({
    start: { x: MARGIN, y },
    end: { x: PAGE_WIDTH - MARGIN, y },
    thickness: 0.8,
    color: RULE,
  });
  y -= 20;
  const totalsX = PAGE_WIDTH - MARGIN - (discountRows.some((row) => row.deal) ? 300 : 160);
  totalsPage.drawText("Merchandise", { x: totalsX, y, size: 10, font: regular, color: MUTED });
  drawRight(totalsPage, formatInvoiceMoney(Number(order.subtotal)), regular, 10, PAGE_WIDTH - MARGIN, y);
  y -= 16;
  for (const row of discountRows) {
    const color = row.deal ? FREE_GREEN : MUTED;
    totalsPage.drawText(pdfSafe(row.label), { x: totalsX, y, size: row.deal ? 9 : 10, font: regular, color });
    drawRight(totalsPage, `-${formatInvoiceMoney(row.amount)}`, regular, 10, PAGE_WIDTH - MARGIN, y, color);
    y -= 16;
  }
  totalsPage.drawText("Shipping", { x: totalsX, y, size: 10, font: regular, color: MUTED });
  drawRight(totalsPage, formatInvoiceMoney(Number(order.shipping_cost)), regular, 10, PAGE_WIDTH - MARGIN, y);
  y -= 16;
  const vatRate = Number(order.vat_rate) || 0;
  const vatAmount = Number(order.vat_amount) || 0;
  totalsPage.drawText(`VAT ${vatRate}%`, { x: totalsX, y, size: 10, font: regular, color: MUTED });
  drawRight(totalsPage, formatInvoiceMoney(vatAmount), regular, 10, PAGE_WIDTH - MARGIN, y);
  y -= 20;
  totalsPage.drawText("Total NAD", { x: totalsX, y, size: 12, font: bold, color: INK });
  drawRight(totalsPage, formatInvoiceMoney(Number(order.total)), bold, 12, PAGE_WIDTH - MARGIN, y);
  y -= 28;
  totalsPage.drawText("Paid in full. Thank you for your order.", { x: MARGIN, y, size: 9, font: regular, color: MUTED });
  y -= 16;
  drawVerifyBox(totalsPage, { id: order.id, x: MARGIN, top: y, width: PAGE_WIDTH - MARGIN * 2, regular, bold });
  totalsPage.drawText(`Page ${pageNo}`, {
    x: MARGIN,
    y: 28,
    size: 8,
    font: regular,
    color: MUTED,
  });

  return doc.save();
}

const cents = (n: number) => Math.round(n * 100) / 100;

/**
 * Discount lines for the totals. The order stores one combined amount, so the
 * Black Friday part is split out only when it fits inside what was charged.
 */
function invoiceDiscountRows(order: OrderRow, offer: BlackFridayOffer) {
  const stored = cents(Number(order.discount_amount) || 0);
  if (stored <= 0) return [];
  const code = (order.discount_code || "").trim();
  const deals = offer.discountTotal;
  const rows: { label: string; amount: number; deal: boolean }[] = [];
  // A customer's own code only appears when it beat the Black Friday deals (they never stack).
  if (code && code !== "BLACKFRIDAY") return [{ label: `Discount ${code.slice(0, 18)}`, amount: stored, deal: false }];
  if (deals > 0 && deals <= stored + 0.005) {
    for (const d of offer.discounts) rows.push({ label: `Black Friday: ${d.label}`, amount: d.amount, deal: true });
    const rest = cents(stored - deals);
    if (rest > 0 && code && code !== "BLACKFRIDAY") rows.push({ label: `Discount ${code.slice(0, 18)}`, amount: rest, deal: false });
    else if (rest > 0) rows.push({ label: "Other discount", amount: rest, deal: false });
    return rows;
  }
  if (code === "BLACKFRIDAY") return [{ label: "Black Friday discount", amount: stored, deal: true }];
  return [{ label: code ? `Discount ${code.slice(0, 18)}` : "Discount", amount: stored, deal: false }];
}
