import { qrMatrix } from "@/lib/passport/qr";

/**
 * QR for the public passport URL, drawn on the server as inline SVG
 * (lib/passport/qr.ts) — no image service, so the passport link is never
 * sent to anyone else.
 */
export function QrBlock({ url }: { url: string }) {
  const { path, viewBox } = qrMatrix(url);
  return (
    <div className="flex flex-col items-center">
      <svg
        role="img"
        aria-label="QR code linking to this passport"
        viewBox={`0 0 ${viewBox} ${viewBox}`}
        width={180}
        height={180}
        shapeRendering="crispEdges"
        className="rounded-input border border-slate-200 bg-white p-2"
      >
        <path d={path} fill="#000" />
      </svg>
      <p className="mt-2 text-[12px] text-secondary">Scan to view this passport</p>
    </div>
  );
}
