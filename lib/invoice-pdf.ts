import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/database.types";
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
const HEADER_BG = rgb(0.06, 0.06, 0.07);
const LIME = rgb(0.71, 1, 0);
const LOGO_FILE = path.join(process.cwd(), "public", "brand", "rappi-logo-v2.png");
const LOGO_NATIVE_WIDTH = 776;
const LOGO_NATIVE_HEIGHT = 478;

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
  drawRight(page, "INVOICE", bold, 18, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 42, LIME);
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

  const cols = {
    code: MARGIN,
    name: MARGIN + 78,
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
    y -= 18;

    if (pageNo === 1) {
      page.drawText("Bill to", { x: MARGIN, y, size: 9, font: bold, color: MUTED });
      y -= 13;
      const buyer = [order.full_name, order.email, order.address, `${order.city}, ${order.country}`];
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
    const nameLines = wrap(item.name, regular, 9, nameWidth);
    const rowHeight = Math.max(16, nameLines.length * 11 + 6);
    ensureSpace(rowHeight);
    const current = page!;
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

  ensureSpace(110);
  const totalsPage = page!;
  totalsPage.drawLine({
    start: { x: MARGIN, y },
    end: { x: PAGE_WIDTH - MARGIN, y },
    thickness: 0.8,
    color: RULE,
  });
  y -= 20;
  const totalsX = PAGE_WIDTH - MARGIN - 160;
  totalsPage.drawText("Merchandise", { x: totalsX, y, size: 10, font: regular, color: MUTED });
  drawRight(totalsPage, formatInvoiceMoney(Number(order.subtotal)), regular, 10, PAGE_WIDTH - MARGIN, y);
  y -= 16;
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
  totalsPage.drawText("Paid in full.", { x: MARGIN, y, size: 9, font: regular, color: MUTED });
  totalsPage.drawText(`Page ${pageNo}`, {
    x: MARGIN,
    y: 28,
    size: 8,
    font: regular,
    color: MUTED,
  });

  return doc.save();
}
