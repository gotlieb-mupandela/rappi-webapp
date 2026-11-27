import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { couponUrl, firstNameInitial, type OpeningCoupon, type OpeningLead } from "@/lib/opening";
import { COUPON_RATE, COUPON_VALID_LABEL, OPENING_DAY_LABEL, STORE_LINE, STORE_WHATSAPP } from "@/lib/opening-options";
import { getProductByCode } from "@/lib/offline-catalog";
import { embedItemPhotos } from "@/lib/pdf-item-photos";
import { drawQrCode } from "@/lib/pdf-verify-box";

const W = 420;
const H = 595;
const M = 30;
const INK = rgb(0.05, 0.07, 0.04);
const LIME = rgb(0.37, 1, 0.22);
const WHITE = rgb(1, 1, 1);
const MUTED = rgb(0.35, 0.35, 0.35);
const SOFT = rgb(0.96, 0.97, 0.95);
const LOGO_FILE = path.join(process.cwd(), "public", "brand", "logo-dark.png");

export function couponFilename(code: string) {
  return `rappi-opening-coupon-${code}.pdf`;
}

function pdfSafe(value: string) {
  return value
    .replace(/[‐-―−]/g, "-")
    .replace(/[‘’]/g, "'")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\x20-\x7E]/g, "");
}

function wrap(text: string, font: PDFFont, size: number, width: number) {
  const words = pdfSafe(text).split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) > width && line) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

function center(page: PDFPage, text: string, font: PDFFont, size: number, y: number, x0: number, w: number, color = INK) {
  const t = pdfSafe(text);
  page.drawText(t, { x: x0 + (w - font.widthOfTextAtSize(t, size)) / 2, y, size, font, color });
}

export async function buildCouponPdf(coupon: Pick<OpeningCoupon, "code">, lead: Pick<OpeningLead, "name" | "wish_code">) {
  const doc = await PDFDocument.create();
  doc.setTitle(`RAPPI Sports Hub opening coupon ${coupon.code}`);
  const page = doc.addPage([W, H]);
  const [regular, bold] = await Promise.all([doc.embedFont(StandardFonts.Helvetica), doc.embedFont(StandardFonts.HelveticaBold)]);

  // Header: logo on white with the lime rule, like the receipts.
  try {
    const logo = await doc.embedPng(await readFile(LOGO_FILE));
    const h = 40;
    page.drawImage(logo, { x: M, y: H - 22 - h, width: h * (1416 / 895), height: h });
  } catch (err) {
    console.error("coupon logo", err);
  }
  page.drawText("OPENING COUPON", { x: W - M - bold.widthOfTextAtSize("OPENING COUPON", 13), y: H - 48, size: 13, font: bold, color: INK });
  page.drawRectangle({ x: 0, y: H - 76, width: W, height: 3, color: LIME });

  // The ticket.
  const top = H - 96;
  const tH = 268;
  page.drawRectangle({ x: M, y: top - tH, width: W - 2 * M, height: tH, color: INK });
  page.drawRectangle({ x: M, y: top - 4, width: W - 2 * M, height: 4, color: LIME });
  page.drawText("RAPPI SPORTS HUB", { x: M + 18, y: top - 28, size: 9, font: bold, color: LIME });
  page.drawText(`${COUPON_RATE}% OFF`, { x: M + 18, y: top - 78, size: 46, font: bold, color: LIME });
  page.drawText("ANY PRODUCT, ONE ORDER", { x: M + 18, y: top - 98, size: 10, font: bold, color: WHITE });
  page.drawText(pdfSafe(`For ${firstNameInitial(lead.name)}`), { x: M + 18, y: top - 122, size: 10, font: regular, color: WHITE });

  const qrSize = 132;
  const qx = W - M - 18 - qrSize;
  page.drawRectangle({ x: qx - 8, y: top - 36 - qrSize - 8, width: qrSize + 16, height: qrSize + 16, color: WHITE });
  drawQrCode(page, couponUrl(coupon.code), qx, top - 36, qrSize);
  center(page, coupon.code, bold, 15, top - 210, M, W - 2 * M, WHITE);
  center(page, `Valid ${COUPON_VALID_LABEL} - in store or online - one use`, regular, 9.5, top - 230, M, W - 2 * M, WHITE);
  center(page, `Store opens ${OPENING_DAY_LABEL}`, bold, 9.5, top - 250, M, W - 2 * M, LIME);

  // Their pick, with a photo when we have one.
  let y = top - tH - 22;
  const wish = lead.wish_code ? getProductByCode(lead.wish_code) : undefined;
  if (wish) {
    const photos = await embedItemPhotos(doc, [wish.code]);
    const photo = photos.get(wish.code);
    const box = 58;
    page.drawRectangle({ x: M, y: y - box, width: W - 2 * M, height: box, color: SOFT });
    let tx = M + 12;
    if (photo) {
      const s = Math.min((box - 10) / photo.width, (box - 10) / photo.height);
      page.drawImage(photo, { x: M + 6, y: y - box + 5, width: photo.width * s, height: photo.height * s });
      tx = M + box + 4;
    }
    page.drawText("YOUR PICK", { x: tx, y: y - 20, size: 8, font: bold, color: MUTED });
    const name = wrap((wish.displayName || wish.name).split(" · ")[0], bold, 10.5, W - M - tx - 10).slice(0, 2);
    name.forEach((line, i) => page.drawText(line, { x: tx, y: y - 34 - i * 12, size: 10.5, font: bold, color: INK }));
    y -= box + 18;
  }

  page.drawText("HOW TO USE IT", { x: M, y, size: 9, font: bold, color: MUTED });
  y -= 15;
  for (const step of [
    "1. Visit the store from 5 January, or shop online at rappisportshub.com.",
    "2. In store: show this QR code at the till before you pay.",
    "3. Online: type the code in the discount box at checkout.",
  ]) {
    for (const line of wrap(step, regular, 9.5, W - 2 * M)) {
      page.drawText(line, { x: M, y, size: 9.5, font: regular, color: INK });
      y -= 13;
    }
  }
  y -= 6;
  page.drawText(pdfSafe(`${STORE_LINE} - WhatsApp ${STORE_WHATSAPP}`), { x: M, y, size: 9.5, font: bold, color: INK });
  y -= 18;
  for (const line of wrap(
    "Personal and single-use: one order, one time. Not exchangeable for cash. Does not combine with other discount codes; Black Friday deals give the bigger saving instead.",
    regular,
    7.5,
    W - 2 * M,
  )) {
    page.drawText(line, { x: M, y, size: 7.5, font: regular, color: MUTED });
    y -= 10;
  }
  return doc.save();
}
