/**
 * QR for the public passport URL. Rendered via a QR image service (no client
 * dependency); swap for `react-qr-code` if you want fully offline rendering.
 */
export function QrBlock({ url }: { url: string }) {
  const src = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=10&data=${encodeURIComponent(url)}`;
  return (
    <div className="flex flex-col items-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt="QR code linking to this passport"
        width={180}
        height={180}
        className="rounded-input border border-slate-200 bg-white p-2"
      />
      <p className="mt-2 text-[12px] text-secondary">Scan to view this passport</p>
    </div>
  );
}
