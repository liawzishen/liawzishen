"use client";

import { useState } from "react";
import { useRefreshData } from "@/lib/router/refresh";

/**
 * In/out-of-stock switch for one of the grower's own listings. The change
 * goes through /api/listings/stock, which checks that the caller is the
 * listing's seller before writing; the marketplace reads the same table and
 * hides Buy / drops promotion for out-of-stock items.
 */
export function StockToggle({
  listingId,
  initialInStock,
}: {
  listingId: string;
  initialInStock: boolean;
}) {
  const [inStock, setInStock] = useState(initialInStock);
  const [busy, setBusy] = useState(false);
  const refreshData = useRefreshData();

  async function toggle() {
    if (busy) return;
    const next = !inStock;
    setBusy(true);
    setInStock(next); // optimistic
    let saved = false;
    try {
      const res = await fetch("/api/listings/stock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId, inStock: next }),
      });
      saved = res.ok;
    } catch {
      // network error — handled as "not saved" below
    }
    setBusy(false);
    if (!saved) {
      setInStock(!next); // revert on failure
      return;
    }
    refreshData(); // the marketplace pages show this stock level too
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
