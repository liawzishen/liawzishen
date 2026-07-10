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

  async function toggle() {
    if (busy) return;
    const next = !inStock;
    setBusy(true);
    setInStock(next); // optimistic
    const supabase = createClient();
    const { error } = await supabase.from("listing_stock").upsert(
      {
        listing_id: listingId,
        seller_farm: sellerFarm,
        in_stock: next,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "listing_id" }
    );
    setBusy(false);
    if (error) setInStock(!next); // revert on failure
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      role="switch"
      aria-checked={inStock}
      className="pressable flex shrink-0 items-center gap-1.5 disabled:opacity-60"
    >
      <span className="text-[11px] font-semibold" style={{ color: inStock ? "#0DB074" : "#EF4444" }}>
        {inStock ? "In stock" : "Out of stock"}
      </span>
      <span
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
  );
}
