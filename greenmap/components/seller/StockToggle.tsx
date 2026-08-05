"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * In/out-of-stock switch for one of the grower's own listings. Upserts
 * listing_stock (0008 RLS lets the owning seller write it); the marketplace
 * reads the same table and hides Buy / drops promotion for out-of-stock items.
 */
export function StockToggle({
  listingId,
  sellerFarm,
  initialInStock,
}: {
  listingId: string;
  sellerFarm: string;
  initialInStock: boolean;
}) {
  const [inStock, setInStock] = useState(initialInStock);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    if (busy) return;
    const next = !inStock;
    setBusy(true);
    setError(null);
    setInStock(next); // optimistic
    const supabase = createClient();
    const { error: writeError } = await supabase.from("listing_stock").upsert(
      {
        listing_id: listingId,
        seller_farm: sellerFarm,
        in_stock: next,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "listing_id" }
    );
    setBusy(false);
    if (writeError) {
      setInStock(!next); // revert on failure
      // The optimistic flip used to be rolled back in silence, so a failed
      // save looked identical to a successful one that had been undone.
      setError("Could not update stock — please try again.");
    }
  }

  return (
    <div className="flex shrink-0 flex-col items-end gap-0.5">
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        aria-busy={busy || undefined}
        role="switch"
        aria-checked={inStock}
        className="pressable flex items-center gap-1.5 disabled:opacity-60"
      >
        {/* Was #0DB074 / #EF4444 — 2.39:1 and 3.20:1 on glass. */}
        <span
          className={`text-[11px] font-semibold ${
            inStock ? "text-brand-dark" : "text-critical-ink"
          }`}
        >
          {inStock ? "In stock" : "Out of stock"}
        </span>
        <span
          aria-hidden="true"
          className={`relative h-5 w-9 rounded-full transition-colors ${
            inStock ? "bg-brand" : "bg-tertiary"
          }`}
        >
          <span
            className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${
              inStock ? "left-[18px]" : "left-0.5"
            }`}
          />
        </span>
      </button>
      {error && (
        <p role="alert" className="text-[11px] font-medium text-critical-ink">
          {error}
        </p>
      )}
    </div>
  );
}
