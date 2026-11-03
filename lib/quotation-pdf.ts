import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";
import { formatInvoiceDate, formatInvoiceMoney, invoiceSeller } from "@/lib/invoice-pdf";

export const QUOTATION_VALID_DAYS = 14;

export type QuotationPdfItem = {
  code: string;
  name: string;
  sizeLabel: string;
  qty: number;
  unitPrice: number;
  lineTotal: number;
};

export type QuotationPdfData = {
  id: string;
  createdAt: string;
  email: string | null;
  items: QuotationPdfItem[];
  subtotal: number;
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
const LOGO_FILE = path.join(process.cwd(), "public", "brand", "logo-dark.png");
const LOGO_NATIVE_WIDTH = 1416;
const LOGO_NATIVE_HEIGHT = 895;

export function quotationFilename(id: string) {
  return `quotation-${id}.pdf`;
}

export function quotationValidUntil(iso: string) {
  const date = new Date(iso);
  date.setUTCDate(date.getUTCDate() + QUOTATION_VALID_DAYS);
  return date.toISOString();
}

function pdfSafe(value: string) {
  return value
    .replace(/\u00b7/g, " - ")
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
    console.error("quotation logo", err);
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
  drawRight(page, "QUOTATION", bold, 18, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 42, INK);
}

export async function buildQuotationPdf(data: QuotationPdfData): Promise<Uint8Array> {
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
    size: PAGE_WIDTH - MARGIN - 210,
    qty: PAGE_WIDTH - MARGIN - 128,
    unit: PAGE_WIDTH - MARGIN - 88,
    amount: PAGE_WIDTH - MARGIN,
  };
  const nameWidth = cols.size - cols.name - 8;
  const sizeWidth = cols.qty - cols.size - 16;
  const notes = [
    "Amounts are in Namibian dollars (N$).",
    "VAT and delivery are not included. They are calculated at checkout.",
    "This quotation does not reserve stock.",
    `Valid for ${QUOTATION_VALID_DAYS} days, until ${formatInvoiceDate(quotationValidUntil(data.createdAt))}.`,
    "This is not a tax invoice.",
  ];

  let page: PDFPage | null = null;
  let y = 0;
  let pageNo = 0;

  const stampPageNumber = () => {
    if (!page) return;
    page.drawText(`Page ${pageNo}`, {
      x: MARGIN,
      y: 28,
      size: 8,
      font: regular,
      color: MUTED,
    });
  };

  const drawTableHead = (current: PDFPage) => {
    current.drawLine({
      start: { x: MARGIN, y },
      end: { x: PAGE_WIDTH - MARGIN, y },
      thickness: 0.8,
      color: RULE,
    });
    y -= 16;
    current.drawText("Code", { x: cols.code, y, size: 8, font: bold, color: MUTED });
    current.drawText("Item", { x: cols.name, y, size: 8, font: bold, color: MUTED });
    current.drawText("Size", { x: cols.size, y, size: 8, font: bold, color: MUTED });
    drawRight(current, "Qty", bold, 8, cols.qty + 18, y, MUTED);
    drawRight(current, "Unit", bold, 8, cols.unit + 36, y, MUTED);
    drawRight(current, "Amount", bold, 8, cols.amount, y, MUTED);
    y -= 8;
    current.drawLine({
      start: { x: MARGIN, y },
      end: { x: PAGE_WIDTH - MARGIN, y },
      thickness: 0.6,
      color: RULE,
    });
    y -= 16;
  };

  const ensureSpace = (needed: number) => {
    if (page && y - needed >= 56) return;
    stampPageNumber();
    page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    pageNo += 1;
    drawBrandHeader(page, logo, bold);
    y = PAGE_HEIGHT - HEADER_HEIGHT - 20;

    if (pageNo === 1) {
      page.drawText(pdfSafe(seller.legalName.toUpperCase()), { x: MARGIN, y, size: 12, font: bold, color: INK });
      y -= 16;
      const sellerLines = [seller.address, seller.city, seller.email].filter(Boolean);
      if (seller.vatNumber) sellerLines.push(`VAT ${seller.vatNumber}`);
      for (const line of sellerLines) {
        page.drawText(pdfSafe(line), { x: MARGIN, y, size: 9, font: regular, color: MUTED });
        y -= 12;
      }
      y -= 8;
      page.drawText(pdfSafe(`Quotation ${data.id}`), { x: MARGIN, y, size: 10, font: bold, color: INK });
      drawRight(page, formatInvoiceDate(data.createdAt), regular, 10, PAGE_WIDTH - MARGIN, y);
      y -= 14;
      if (data.email) {
        const prepared = wrap(`Prepared for ${data.email}`, regular, 9, PAGE_WIDTH - MARGIN * 2);
        for (const line of prepared) {
          page.drawText(line, { x: MARGIN, y, size: 9, font: regular, color: MUTED });
          y -= 12;
        }
      }
      y -= 6;
    }

    drawTableHead(page);
  };

  ensureSpace(220);

  for (const item of data.items) {
    const nameLines = wrap(item.name, regular, 9, nameWidth);
    const sizeLines = wrap(item.sizeLabel, regular, 8, sizeWidth);
    const rowHeight = Math.max(16, Math.max(nameLines.length, sizeLines.length) * 11 + 6);
    ensureSpace(rowHeight);
    const current = page!;
    current.drawText(pdfSafe(item.code), { x: cols.code, y, size: 8, font: regular, color: INK });
    drawRight(current, String(item.qty), regular, 9, cols.qty + 18, y);
    drawRight(current, formatInvoiceMoney(item.unitPrice), regular, 9, cols.unit + 36, y);
    drawRight(current, formatInvoiceMoney(item.lineTotal), regular, 9, cols.amount, y);
    let nameY = y;
    for (const line of nameLines) {
      current.drawText(line, { x: cols.name, y: nameY, size: 9, font: regular, color: INK });
      nameY -= 11;
    }
    let sizeY = y;
    for (const line of sizeLines) {
      current.drawText(line, { x: cols.size, y: sizeY, size: 8, font: regular, color: INK });
      sizeY -= 11;
    }
    y -= rowHeight;
  }

  const noteLines = notes.flatMap((note) => wrap(note, regular, 9, PAGE_WIDTH - MARGIN * 2));
  ensureSpace(52 + noteLines.length * 12);
  const totalsPage = page!;
  totalsPage.drawLine({
    start: { x: MARGIN, y },
    end: { x: PAGE_WIDTH - MARGIN, y },
    thickness: 0.8,
    color: RULE,
  });
  y -= 22;
  totalsPage.drawText("Subtotal", { x: PAGE_WIDTH - MARGIN - 160, y, size: 12, font: bold, color: INK });
  drawRight(totalsPage, formatInvoiceMoney(data.subtotal), bold, 12, PAGE_WIDTH - MARGIN, y);
  y -= 22;
  for (const line of noteLines) {
    totalsPage.drawText(line, { x: MARGIN, y, size: 9, font: regular, color: MUTED });
    y -= 12;
  }
  stampPageNumber();

  return doc.save();
}
