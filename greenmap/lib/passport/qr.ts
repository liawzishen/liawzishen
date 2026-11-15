import qrcode from "qrcode-generator";

/*
 * The QR code for a passport link, drawn on our own server.
 *
 * It used to be an image from a public QR web service, which meant every
 * passport link (the link IS the key to the passport) was sent to a third
 * party, and the page depended on that service being up. Now the code is
 * computed here and sent as a few hundred bytes of SVG.
 */

export interface QrMatrix {
  /** Modules (small squares) per side, without the quiet zone. */
  size: number;
  /** SVG path data that draws every dark module, quiet zone included. */
  path: string;
  /** Side of the SVG view box: `size` plus the quiet zone on both sides. */
  viewBox: number;
}

/** White border the QR standard asks for, in modules. */
const QUIET_ZONE = 4;

/**
 * The QR code for `text` (error correction M: still scans with ~15% of the
 * code damaged or dirty, which suits a printed label on produce).
 */
export function qrMatrix(text: string): QrMatrix {
  const qr = qrcode(0, "M");
  qr.addData(text);
  qr.make();

  const size = qr.getModuleCount();
  const parts: string[] = [];
  for (let row = 0; row < size; row++) {
    // One rectangle per run of dark modules keeps the path short.
    let runStart = -1;
    for (let col = 0; col <= size; col++) {
      const dark = col < size && qr.isDark(row, col);
      if (dark && runStart === -1) runStart = col;
      if (!dark && runStart !== -1) {
        parts.push(
          `M${runStart + QUIET_ZONE} ${row + QUIET_ZONE}h${col - runStart}v1h-${col - runStart}z`
        );
        runStart = -1;
      }
    }
  }
  return { size, path: parts.join(""), viewBox: size + QUIET_ZONE * 2 };
}
