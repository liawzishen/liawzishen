"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { LISTINGS } from "./demo-listings";

/**
 * Simulated buyer marketplace (Phase-3 preview). Location-first, freshness-aware,
 * passport-powered listing cards with working mock filters. Buy/Journey link to
 * the listing detail. No real checkout or persistence.
 */

const FILTERS = ["All", "✓ Passport", "Within 10km", "Harvested today"];

export function Marketplace({
  farmId,
  boostedIds = [],
}: {
  farmId: string;
  /** Listings with an active paid boost — shown first with a Promoted tag. */
  boostedIds?: string[];
}) {
  const [filter, setFilter] = useState("All");

  const listings = LISTINGS.filter((l) => {
    if (filter === "✓ Passport") return l.verified;
    if (filter === "Within 10km") return l.distanceKm <= 10;
    if (filter === "Harvested today") return l.freshness === "Harvested today";
    return true;
  });

  const boosted = new Set(boostedIds);
  const sorted = [...listings].sort(
    (a, b) => Number(boosted.has(b.id)) - Number(boosted.has(a.id))
  );

  return (
    <div className="pb-8">
      <div className="px-5 pt-2">
        <div className="flex items-center gap-2">
          <p className="text-[12px] font-semibold uppercase tracking-widest text-secondary">
            Near Petaling Jaya
          </p>
          <Badge tone="warning">PREVIEW</Badge>
        </div>
        <p className="mt-1 text-[14px] text-secondary">
          Fresh produce from verified growers near you.
        </p>
      </div>

      {/* Filter chips (working mock) */}
      <div className="mt-4 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`shrink-0 rounded-full px-4 py-2 text-[13px] font-semibold transition active:scale-95 ${
              filter === f ? "bg-brand text-white" : "bg-card text-label shadow-card"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Product cards */}
      <div className="mt-4 space-y-4 px-5">
        {sorted.map((l) => (
          <div key={l.id} className="overflow-hidden rounded-card bg-card shadow-card">
            <div className="relative h-32" style={{ background: l.gradient }}>
              <span className="absolute left-3 top-3 text-[40px]">{l.emoji}</span>
              {l.verified && (
                <span className="absolute right-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-brand-dark">
                  ✓ Passport Verified
                </span>
              )}
              {boosted.has(l.id) && (
                <span className="absolute bottom-3 left-3 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-warning">
                  ⚡ Promoted
                </span>
              )}
            </div>
            <div className="p-4">
              <p className="text-[16px] font-semibold">{l.name}</p>
              <p className="mt-0.5 text-[13px] text-secondary">
                {l.farm} · {l.freshness} · {l.distanceKm} km
              </p>
              {l.badges.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {l.badges.map((b) => (
                    <span
                      key={b}
                      className="rounded-full bg-brand/12 px-2 py-0.5 text-[11px] font-semibold text-brand-dark"
                    >
                      {b}
                    </span>
                  ))}
                </div>
              )}
              <div className="mt-3 flex items-center justify-between">
                <div>
                  <span className="text-[18px] font-bold text-brand">RM {l.price}</span>
                  <span className="text-[13px] text-secondary">/{l.unit}</span>
                </div>
                <div className="flex items-center gap-3">
                  {l.verified && (
                    <Link
                      href={`/farms/${farmId}/sales/market/${l.id}`}
                      className="text-[13px] font-semibold text-info"
                    >
                      🔍 Journey
                    </Link>
                  )}
                  <Link
                    href={`/farms/${farmId}/sales/market/${l.id}`}
                    className="rounded-btn bg-brand px-5 py-2.5 text-[15px] font-semibold text-white transition active:scale-95"
                  >
                    Buy
                  </Link>
                </div>
              </div>
            </div>
          </div>
        ))}
        {listings.length === 0 && (
          <p className="py-10 text-center text-[14px] text-secondary">
            No listings match that filter.
          </p>
        )}
      </div>
    </div>
  );
}
