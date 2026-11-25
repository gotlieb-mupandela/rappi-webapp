import "server-only";

import QRCode from "qrcode";
import { rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { documentVerifyCode, documentVerifyHost, documentVerifyUrl } from "@/lib/document-verify";

export const VERIFY_BOX_HEIGHT = 80;

const GREEN = rgb(88 / 255, 184 / 255, 44 / 255);
const TINT = rgb(0.965, 0.984, 0.953);
const INK = rgb(0.1, 0.1, 0.1);
const MUTED = rgb(0.35, 0.35, 0.35);

/** Draws the "check this document is genuine" box with its QR code; `top` is the box's top edge. */
export function drawVerifyBox(
  page: PDFPage,
  opts: { id: string; x: number; top: number; width: number; regular: PDFFont; bold: PDFFont },
) {
  const { id, x, top, width, regular, bold } = opts;
  const h = VERIFY_BOX_HEIGHT;
  page.drawRectangle({ x, y: top - h, width, height: h, color: TINT, borderColor: GREEN, borderWidth: 1 });

  const qr = QRCode.create(documentVerifyUrl(id), { errorCorrectionLevel: "M" });
  const n = qr.modules.size;
  const qrSize = h - 14;
  const cell = qrSize / n;
  const qx = x + 7;
  const qy = top - 7;
  page.drawRectangle({ x: qx, y: qy - qrSize, width: qrSize, height: qrSize, color: rgb(1, 1, 1) });
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
        x: qx + start * cell,
        y: qy - (r + 1) * cell,
        width: (c - start) * cell,
        height: cell + 0.05,
        color: INK,
      });
    }
  }

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
