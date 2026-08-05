"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { LISTINGS } from "./demo-listings";
import { rankListings, type RankReason } from "@/lib/marketplace/rank";

/**
 * Simulated buyer marketplace (Phase-3 preview). Location-first, freshness-aware,
 * passport-powered listing cards with working mock filters. Ordering is decided
 * by the shared ranking engine (lib/marketplace/rank.ts): paid boosts get the
 * top (capped) slots, then a weighted organic score — popularity, engagement
 * (clicks + dwell), freshness, trust, proximity and health. Buy/Journey link to
 * the listing detail. No real checkout or persistence.
 */

const FILTERS = ["All", "✓ Passport", "Within 10km", "Harvested today"];

/** Ranking reason → a small explanatory chip on the card. The "promoted"
 *  entry is never rendered (promoted cards show the ⚡ badge instead) but is
 *  included so the lookup is total over RankReason. */
const REASON_CHIP: Record<RankReason, string> = {
  promoted: "⚡ Promoted",
  popular: "🔥 Popular",
  trending: "📈 Trending",
  fresh: "🌱 Just harvested",
  nearby: "📍 Nearby",
  verified: "✓ Trusted grower",
  new: "✨ New listing",
};

export function Marketplace({
  basePath,
  boostedIds = [],
  outOfStockIds = [],
}: {
  /** URL prefix for a listing detail — grower or consumer market route.
   *  A card links to `${basePath}/${listingId}`. */
  basePath: string;
  /** Listings with an active paid boost — shown first with a Promoted tag. */
  boostedIds?: string[];
  /** Listings the seller has marked out of stock (from listing_stock). */
  outOfStockIds?: string[];
}) {
  const [filter, setFilter] = useState("All");

  const ranked = useMemo(() => {
    const oos = new Set(outOfStockIds);
    const filtered = LISTINGS.filter((l) => {
      if (filter === "✓ Passport") return l.verified;
      if (filter === "Within 10km") return l.distanceKm <= 10;
      if (filter === "Harvested today") return l.freshness === "Harvested today";
      return true;
    });

    // The ranker works in absolute time; convert each listing's "hours ago"
    // into a harvest timestamp so freshness decays relative to now. Out-of-stock
    // items still show, but inStock:false drops them from the promoted slots.
    const now = Date.now();
    const rankable = filtered.map((l) => ({
      ...l,
      harvestedAt: new Date(now - l.harvestedHoursAgo * 3_600_000).toISOString(),
      inStock: !oos.has(l.id),
    }));

    return rankListings(rankable, { boostedIds, now: new Date(now) });
  }, [filter, boostedIds, outOfStockIds]);

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
              filter === f ? "bg-brand text-white" : "bg-white/70 text-label shadow-card"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Product cards — ordered by the ranking engine */}
      <div className="mt-4 space-y-4 px-5">
        {ranked.map(({ listing: l, promoted, reason }) => {
          const outOfStock = l.inStock === false;
          return (
          <div key={l.id} className="overflow-hidden rounded-card glass">
            <div
              className="relative h-32"
              style={{ background: l.gradient, opacity: outOfStock ? 0.55 : 1 }}
            >
              <span className="absolute left-3 top-3 text-[40px]">{l.emoji}</span>
              {l.verified && (
                <span className="absolute right-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-brand-dark">
                  ✓ Passport Verified
                </span>
              )}
              {outOfStock ? (
                <span className="absolute bottom-3 left-3 rounded-full bg-label/85 px-2.5 py-1 text-[11px] font-semibold text-white">
                  Out of stock
                </span>
              ) : (
                promoted && (
                  <span className="absolute bottom-3 left-3 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-warning-ink">
                    ⚡ Promoted
                  </span>
                )
              )}
            </div>
            <div className="p-4">
              <div className="flex items-center gap-2">
                <p className="text-[16px] font-semibold">{l.name}</p>
                {!promoted && (
                  <span className="shrink-0 rounded-full bg-fill px-2 py-0.5 text-[11px] font-semibold text-secondary">
                    {REASON_CHIP[reason]}
                  </span>
                )}
              </div>
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
                      href={`${basePath}/${l.id}`}
                      className="text-[13px] font-semibold text-info-ink transition-opacity active:opacity-60"
                    >
                      🔍 Journey
                    </Link>
                  )}
                  {outOfStock ? (
                    <span className="rounded-btn bg-fill px-5 py-2.5 text-[15px] font-semibold text-tertiary">
                      Sold out
                    </span>
                  ) : (
                    <Link
                      href={`${basePath}/${l.id}`}
                      className="rounded-btn bg-brand px-5 py-2.5 text-[15px] font-semibold text-white transition active:scale-95"
                    >
                      Buy
                    </Link>
                  )}
                </div>
              </div>
            </div>
          </div>
          );
        })}
        {ranked.length === 0 && (
          <p className="py-10 text-center text-[14px] text-secondary">
            No listings match that filter.
          </p>
        )}
      </div>
    </div>
  );
}
