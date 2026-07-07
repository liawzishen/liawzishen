"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import type { Listing } from "./demo-listings";

/**
 * Simulated listing detail + checkout (Phase-3 preview): produce, passport
 * traceability preview, quantity, fulfilment, and a mock FPX / Touch 'n Go
 * payment that ends in "Order placed!". No real charge, no persistence.
 */
export function ListingDetail({
  listing,
  promoted,
  marketHref,
  secondaryHref,
  secondaryLabel,
}: {
  listing: Listing;
  /** True while the listing has an active paid boost (listing_boosts). */
  promoted?: boolean;
  /** "Back to Marketplace" target (grower or consumer route). */
  marketHref: string;
  /** Optional second CTA after ordering (e.g. My Sales / Keep browsing). */
  secondaryHref?: string;
  secondaryLabel?: string;
}) {
  const [qty, setQty] = useState(2);
  const [mode, setMode] = useState<"pickup" | "delivery">("pickup");
  const [stage, setStage] = useState<"detail" | "pay" | "done">("detail");
  const [pay, setPay] = useState<"fpx" | "tng">("fpx");

  const deliveryFee = mode === "delivery" ? 5 : 0;
  const total = listing.price * qty + deliveryFee;

  /* ── Order placed ── */
  if (stage === "done") {
    return (
      <div className="px-6 pt-10 text-center">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-brand/15 text-[32px]">
          🎉
        </div>
        <h2 className="mt-4 text-[22px] font-bold">Order placed!</h2>
        <p className="mt-1.5 text-[15px] leading-relaxed text-secondary">
          {qty} {listing.unit} of <b>{listing.name}</b> from {listing.farm}. Your
          payment is held in escrow — {listing.grower} has 2 hours to confirm,
          then it&apos;s released.
        </p>
        <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-brand/10 px-3 py-1.5 text-[13px] font-semibold text-brand-dark">
          🌱 +{Math.round(total)} GreenPoints earned
        </div>
        <p className="mt-3 text-[12px] text-secondary">
          Order #GM-{listing.id.toUpperCase()}-{String(qty).padStart(2, "0")}
        </p>
        <div className="mt-7 space-y-3">
          <Button href={marketHref} full>
            Back to Marketplace
          </Button>
          {secondaryHref && secondaryLabel && (
            <Button href={secondaryHref} variant="fill" full>
              {secondaryLabel}
            </Button>
          )}
        </div>
      </div>
    );
  }

  /* ── Payment ── */
  if (stage === "pay") {
    return (
      <div className="px-6 pb-28 pt-2">
        <p className="text-[13px] font-semibold uppercase tracking-wide text-secondary">
          Payment method
        </p>
        <div className="mt-2 space-y-2">
          <PayRow
            icon="🏦"
            title="FPX Online Banking"
            sub="Maybank, CIMB, Public Bank…"
            on={pay === "fpx"}
            onClick={() => setPay("fpx")}
          />
          <PayRow
            icon="📱"
            title="Touch 'n Go eWallet"
            sub="Pay with your TnG balance"
            on={pay === "tng"}
            onClick={() => setPay("tng")}
          />
        </div>

        <p className="mt-6 text-[13px] font-semibold uppercase tracking-wide text-secondary">
          Order summary
        </p>
        <div className="mt-2 rounded-card p-4 text-[14px] glass">
          <Row
            label={`${listing.name} × ${qty} ${listing.unit}`}
            value={`RM ${(listing.price * qty).toFixed(2)}`}
          />
          <Row
            label="Delivery"
            value={deliveryFee ? `RM ${deliveryFee.toFixed(2)}` : "Free (pickup)"}
          />
          <div className="mt-2 border-t border-tertiary pt-2">
            <Row label="Total" value={`RM ${total.toFixed(2)}`} bold />
          </div>
        </div>
        <p className="mt-3 flex items-start gap-2 text-[12px] text-secondary">
          <span>🔒</span> Simulated payment — no real charge. Funds would sit in
          escrow for 24h before payout.
        </p>

        <div className="fixed bottom-0 left-1/2 w-full max-w-[430px] -translate-x-1/2 px-6 py-4 glass-strong">
          <Button full onClick={() => setStage("done")}>
            Pay RM {total.toFixed(2)}
          </Button>
        </div>
      </div>
    );
  }

  /* ── Detail ── */
  return (
    <div className="pb-28">
      <div className="relative h-52" style={{ background: listing.gradient }}>
        <span className="absolute left-4 top-4 text-[56px]">{listing.emoji}</span>
        {listing.verified && (
          <span className="absolute right-4 top-4 rounded-full bg-white/90 px-3 py-1 text-[12px] font-semibold text-brand-dark">
            ✓ Passport Verified
          </span>
        )}
        {promoted && (
          <span className="absolute bottom-4 left-4 rounded-full bg-white/90 px-3 py-1 text-[12px] font-semibold text-warning">
            ⚡ Promoted
          </span>
        )}
      </div>

      <div className="px-6 pt-4">
        <h1 className="text-[24px] font-bold leading-tight">{listing.name}</h1>
        <p className="mt-1 text-[14px] text-secondary">
          {listing.farm} · {listing.grower} · {listing.distanceKm} km ·{" "}
          {listing.freshness}
        </p>
        <div className="mt-2 flex items-baseline gap-1">
          <span className="text-[24px] font-bold text-brand">RM {listing.price}</span>
          <span className="text-[14px] text-secondary">/{listing.unit}</span>
        </div>

        {listing.badges.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {listing.badges.map((b) => (
              <Badge key={b} tone="brand">
                ✓ {b}
              </Badge>
            ))}
          </div>
        )}

        {/* QR traceability preview */}
        {listing.verified && (
          <div className="mt-5 rounded-card p-4 glass">
            <p className="text-[13px] font-semibold uppercase tracking-wide text-secondary">
              Traceability
            </p>
            <div className="mt-3 flex gap-4">
              <div className="grid h-20 w-20 shrink-0 place-items-center rounded-input bg-white shadow-card">
                <QrGlyph />
              </div>
              <div className="flex-1 text-[13px]">
                <Trace icon="🌱" label="Planted" sub={listing.plantedDate} />
                <Trace
                  icon="🔬"
                  label="AI Health Check"
                  sub={`Verified · ${listing.avgHealth}%`}
                />
                <Trace icon="🧺" label="Harvested" sub={listing.harvestDate} last />
              </div>
            </div>
            <p className="mt-3 text-[12px] text-secondary">
              Scan the QR on the produce to see the full growing journey.
            </p>
          </div>
        )}

        {/* Quantity */}
        <div className="mt-5 flex items-center justify-between rounded-card p-4 glass">
          <span className="text-[15px] font-medium">Quantity ({listing.unit})</span>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setQty((q) => Math.max(1, q - 1))}
              className="grid h-9 w-9 place-items-center rounded-full bg-fill text-[20px] font-bold active:scale-90"
              aria-label="Decrease quantity"
            >
              −
            </button>
            <span className="w-6 text-center text-[18px] font-bold">{qty}</span>
            <button
              type="button"
              onClick={() => setQty((q) => q + 1)}
              className="grid h-9 w-9 place-items-center rounded-full bg-fill text-[20px] font-bold active:scale-90"
              aria-label="Increase quantity"
            >
              +
            </button>
          </div>
        </div>

        {/* Fulfilment */}
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => setMode("pickup")}
            className={`flex-1 rounded-input p-3 text-[14px] font-medium transition ${
              mode === "pickup" ? "bg-brand text-white" : "bg-fill text-label"
            }`}
          >
            📍 Pickup · Free
          </button>
          <button
            type="button"
            onClick={() => setMode("delivery")}
            className={`flex-1 rounded-input p-3 text-[14px] font-medium transition ${
              mode === "delivery" ? "bg-brand text-white" : "bg-fill text-label"
            }`}
          >
            🛵 Delivery · RM 5
          </button>
        </div>
      </div>

      <div className="fixed bottom-0 left-1/2 w-full max-w-[430px] -translate-x-1/2 px-6 py-4 glass-strong">
        <Button full onClick={() => setStage("pay")}>
          Buy now · RM {total.toFixed(2)}
        </Button>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  bold,
}: {
  label: string;
  value: string;
  bold?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <span className={bold ? "font-semibold" : "text-secondary"}>{label}</span>
      <span className={bold ? "text-[16px] font-bold" : "font-medium"}>{value}</span>
    </div>
  );
}

function PayRow({
  icon,
  title,
  sub,
  on,
  onClick,
}: {
  icon: string;
  title: string;
  sub: string;
  on: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-input p-3.5 text-left glass transition active:opacity-80"
    >
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-fill text-[18px]">
        {icon}
      </span>
      <div className="flex-1">
        <p className="text-[15px] font-medium">{title}</p>
        <p className="text-[12px] text-secondary">{sub}</p>
      </div>
      <span
        className={`grid h-6 w-6 place-items-center rounded-full border-2 text-[13px] ${
          on ? "border-brand bg-brand text-white" : "border-tertiary text-transparent"
        }`}
      >
        ✓
      </span>
    </button>
  );
}

function Trace({
  icon,
  label,
  sub,
  last,
}: {
  icon: string;
  label: string;
  sub: string;
  last?: boolean;
}) {
  return (
    <div className={`flex items-center gap-2 ${last ? "" : "mb-2"}`}>
      <span className="text-[15px]">{icon}</span>
      <span className="font-medium">{label}</span>
      <span className="truncate text-secondary">· {sub}</span>
    </div>
  );
}

function QrGlyph() {
  return (
    <svg width="56" height="56" viewBox="0 0 90 90" aria-hidden>
      <rect width="90" height="90" fill="white" />
      <g fill="#11181C">
        <rect x="6" y="6" width="24" height="24" />
        <rect x="12" y="12" width="12" height="12" fill="white" />
        <rect x="60" y="6" width="24" height="24" />
        <rect x="66" y="12" width="12" height="12" fill="white" />
        <rect x="6" y="60" width="24" height="24" />
        <rect x="12" y="66" width="12" height="12" fill="white" />
        <rect x="42" y="6" width="6" height="6" />
        <rect x="42" y="42" width="6" height="6" />
        <rect x="60" y="42" width="6" height="6" />
        <rect x="42" y="60" width="6" height="6" />
        <rect x="60" y="60" width="12" height="12" />
      </g>
    </svg>
  );
}
