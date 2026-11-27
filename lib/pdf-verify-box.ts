import "server-only";

import QRCode from "qrcode";
import { rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { documentVerifyCode, documentVerifyHost, documentVerifyUrl } from "@/lib/document-verify";

export const VERIFY_BOX_HEIGHT = 80;

const GREEN = rgb(88 / 255, 184 / 255, 44 / 255);
const TINT = rgb(0.965, 0.984, 0.953);
const INK = rgb(0.1, 0.1, 0.1);
const MUTED = rgb(0.35, 0.35, 0.35);

/** Draws a QR code as vector squares on a white square; `top` is its top edge. */
export function drawQrCode(page: PDFPage, text: string, x: number, top: number, size: number) {
  const qr = QRCode.create(text, { errorCorrectionLevel: "M" });
  const n = qr.modules.size;
  const cell = size / n;
  page.drawRectangle({ x, y: top - size, width: size, height: size, color: rgb(1, 1, 1) });
  for (let r = 0; r < n; r++) {
    let c = 0;
    while (c < n) {
      if (!qr.modules.get(r, c)) {
        c++;
        continue;
      }
      const start = c;
      while (c < n && qr.modules.get(r, c)) c++;
      page.drawRectangle({
        x: x + start * cell,
        y: top - (r + 1) * cell,
        width: (c - start) * cell,
        height: cell + 0.05,
        color: INK,
      });
    }
  }
}

/** Draws the "check this document is genuine" box with its QR code; `top` is the box's top edge. */
export function drawVerifyBox(
  page: PDFPage,
  opts: { id: string; x: number; top: number; width: number; regular: PDFFont; bold: PDFFont },
) {
  const { id, x, top, width, regular, bold } = opts;
  const h = VERIFY_BOX_HEIGHT;
  page.drawRectangle({ x, y: top - h, width, height: h, color: TINT, borderColor: GREEN, borderWidth: 1 });

  const qrSize = h - 14;
  const qx = x + 7;
  drawQrCode(page, documentVerifyUrl(id), qx, top - 7, qrSize);

  const tx = qx + qrSize + 14;
  page.drawText("Check this document is genuine", { x: tx, y: top - 20, size: 10.5, font: bold, color: INK });
  page.drawText(`Scan the QR code, or go to ${documentVerifyHost()}/verify`, {
    x: tx,
    y: top - 35,
    size: 8.5,
    font: regular,
    color: MUTED,
  });
  page.drawText("and enter the code:", { x: tx, y: top - 47, size: 8.5, font: regular, color: MUTED });
  page.drawText(documentVerifyCode(id), { x: tx, y: top - 64, size: 11, font: bold, color: INK });
}
