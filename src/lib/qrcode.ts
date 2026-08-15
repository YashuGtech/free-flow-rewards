import qrcode from "qrcode-generator";

/**
 * Generates a QR code for `data` as an inline SVG string — rendered fully
 * offline. No external QR API (api.qrserver.com) is involved, so the code
 * always shows even when third-party image hosts are blocked (Telegram
 * webviews, strict CSPs, etc.).
 *
 * Error-correction level M, auto version (covers long EVM addresses and
 * payment URIs comfortably).
 */
export function qrSvg(data: string, size = 220): string {
  const qr = qrcode(0, "M"); // 0 = auto-detect version
  qr.addData(data);
  qr.make();
  const count = qr.getModuleCount();
  const cell = Math.max(2, Math.floor((size - 24) / count));
  const margin = 12;
  const dim = count * cell + margin * 2;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${dim}" height="${dim}" viewBox="0 0 ${dim} ${dim}" shape-rendering="crispEdges">`;
  svg += `<rect width="100%" height="100%" fill="#fff"/>`;
  for (let r = 0; r < count; r++) {
    for (let c = 0; c < count; c++) {
      if (qr.isDark(r, c)) {
        svg += `<rect x="${margin + c * cell}" y="${margin + r * cell}" width="${cell}" height="${cell}" fill="#000"/>`;
      }
    }
  }
  svg += `</svg>`;
  return svg;
}
