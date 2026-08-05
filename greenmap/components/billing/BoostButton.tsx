"use client";

import { useState } from "react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { CheckoutSheet } from "@/components/billing/CheckoutSheet";
import {
  BOOST_PACKAGES,
  formatRM,
  type BoostPackageId,
} from "@/lib/billing/plans";

/**
 * "⚡ Boost" on the farmer's own listing rows (Shopee-Ads equivalent).
 * Package picker → simulated checkout → the listing shows "Promoted" at the
 * top of the Marketplace until the boost expires.
 */
export function BoostButton({
  listingId,
  listingName,
  activeUntil,
}: {
  listingId: string;
  listingName: string;
  activeUntil?: string | null;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selected, setSelected] = useState<BoostPackageId | null>(null);

  const activeMs = activeUntil ? new Date(activeUntil).getTime() - Date.now() : 0;
  if (activeMs > 0) {
    const daysLeft = Math.max(1, Math.ceil(activeMs / 86_400_000));
    return (
      <span className="shrink-0 rounded-full bg-warning/15 px-3 py-1.5 text-[12px] font-semibold text-warning-ink">
        ⚡ Promoted · {daysLeft}d left
      </span>
    );
  }

  const pkg = selected ? BOOST_PACKAGES[selected] : null;

  return (
    <>
      <button
        type="button"
        onClick={() => setPickerOpen(true)}
        className="shrink-0 rounded-full bg-warning/15 px-3.5 py-2 text-[13px] font-semibold text-warning-ink transition active:scale-95"
      >
        ⚡ Boost
      </button>

      <BottomSheet
        open={pickerOpen && !selected}
        onClose={() => setPickerOpen(false)}
        ariaLabel={`Boost ${listingName}`}
      >
        <h2 className="text-[18px] font-bold">⚡ Boost this listing</h2>
        <p className="mt-1 text-[13px] text-secondary">
          <b>{listingName}</b> jumps to the top of the Marketplace with a
          Promoted tag.
        </p>
        <div className="mt-4 space-y-2">
          {Object.values(BOOST_PACKAGES).map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setSelected(p.id)}
              className="flex w-full items-center justify-between rounded-card bg-fill p-4 text-left transition active:scale-[0.99]"
            >
              <span>
                <span className="block text-[15px] font-semibold">{p.label}</span>
                <span className="block text-[12px] text-secondary">
                  Top of Marketplace
                </span>
              </span>
              <span className="text-[16px] font-bold text-brand">
                {formatRM(p.priceRM)}
              </span>
            </button>
          ))}
        </div>
        <p className="mt-4 flex items-start gap-1.5 text-[12px] text-secondary">
          <span>🔒</span>
          <span>
            Demo mode — transactions are simulated. Gateway integration ready
            for production.
          </span>
        </p>
      </BottomSheet>

      {pkg && (
        <CheckoutSheet
          open
          onClose={() => {
            setSelected(null);
            setPickerOpen(false);
          }}
          title={`Boost "${listingName}"`}
          amountRM={pkg.priceRM}
          lines={[[`Promoted for ${pkg.label}`, formatRM(pkg.priceRM)]]}
          payload={{ kind: "boost", listingId, package: pkg.id }}
        />
      )}
    </>
  );
}
