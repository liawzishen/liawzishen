"use client";

import { useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { BoostButton } from "@/components/billing/BoostButton";

/**
 * Simulated "My Sales" hub (Phase-3 preview). Realistic demo data + a working
 * mock "Confirm order" interaction. No persistence, no real payment — the
 * marketplace stays a preview for the hackathon.
 */

const EARNINGS = [
  { label: "This Month", value: "RM 342", color: "#0DB074" },
  { label: "Active Listings", value: "3", color: "#1E434A" },
  { label: "Pending Orders", value: "2", color: "#F59E0B" },
];

const ORDERS = [
  { id: "o1", buyer: "Siti", item: "2 kg Cherry Tomatoes", mode: "Pickup", emoji: "🍅" },
  { id: "o2", buyer: "Lee Wei", item: "3 kg Red Chili", mode: "Delivery · 8 km", emoji: "🌶️" },
];

// ids match the shared marketplace mock data (demo-listings.ts) so a boost
// bought here shows as "Promoted" on the same card in the Marketplace.
const LISTINGS = [
  { id: "l1", emoji: "🍅", name: "Organic Cherry Tomatoes", meta: "18 kg left · RM 8/kg", expires: "Expires in 2 days", verified: true },
  { id: "l2", emoji: "🌶️", name: "Fresh Red Chili", meta: "5 kg left · RM 12/kg", expires: "Expires tomorrow", verified: true },
  { id: "l3", emoji: "🥬", name: "Pak Choi", meta: "30 bundles · RM 3/bundle", expires: "Listed today", verified: false },
];

export function SalesDashboard({
  farmId,
  boosts = {},
}: {
  farmId: string;
  /** listingId → active boost expires_at (ISO), from listing_boosts. */
  boosts?: Record<string, string>;
}) {
  const [confirmed, setConfirmed] = useState<Record<string, boolean>>({});

  return (
    <main className="px-5 pb-6 pt-12">
      <div className="flex items-center gap-2">
        <p className="text-[12px] font-semibold uppercase tracking-widest text-secondary">
          Selling
        </p>
        <Badge tone="warning">PREVIEW</Badge>
      </div>
      <h1 className="mt-1 text-[28px] font-bold leading-tight">My Sales</h1>

      {/* Earnings strip (simulated) */}
      <div className="-mx-5 mt-4 flex gap-3 overflow-x-auto px-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {EARNINGS.map((e) => (
          <div
            key={e.label}
            className="w-[140px] shrink-0 rounded-card p-4 glass"
          >
            <p className="text-[22px] font-bold leading-none" style={{ color: e.color }}>
              {e.value}
            </p>
            <p className="mt-1.5 text-[12px] text-secondary">{e.label}</p>
          </div>
        ))}
      </div>

      {/* Pending orders — interactive mock Confirm */}
      <h2 className="mb-2 mt-7 text-[13px] font-semibold uppercase tracking-wide text-secondary">
        Pending Orders
      </h2>
      <Card className="p-0">
        {ORDERS.map((o, i) => {
          const done = confirmed[o.id];
          return (
            <div
              key={o.id}
              className={`flex items-center gap-3 p-4 ${i > 0 ? "hairline-t" : ""}`}
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-fill text-[16px]">
                {o.emoji}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-medium">
                  {o.buyer} · {o.item}
                </p>
                <p className="truncate text-[12px] text-secondary">
                  {o.mode} · confirm within 2h
                </p>
              </div>
              {done ? (
                <span className="shrink-0 text-[13px] font-semibold text-brand">
                  Confirmed ✓
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmed((c) => ({ ...c, [o.id]: true }))}
                  className="shrink-0 rounded-full bg-brand px-3.5 py-2 text-[13px] font-semibold text-white transition active:scale-95 active:opacity-80"
                >
                  Confirm
                </button>
              )}
            </div>
          );
        })}
      </Card>

      {/* Active listings */}
      <div className="mb-2 mt-7 flex items-center justify-between">
        <h2 className="text-[13px] font-semibold uppercase tracking-wide text-secondary">
          Active Listings
        </h2>
        <Link
          href={`/farms/${farmId}/sales/new`}
          className="text-[13px] font-semibold text-brand"
        >
          + New
        </Link>
      </div>
      <Card className="p-0">
        {LISTINGS.map((l, i) => (
          <div
            key={l.id}
            className={`flex items-center gap-3 p-4 ${i > 0 ? "hairline-t" : ""}`}
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-input bg-fill text-[18px]">
              {l.emoji}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-medium">{l.name}</p>
              <p className="truncate text-[12px] text-secondary">
                {l.meta} · {l.expires}
              </p>
            </div>
            {l.verified && <Badge tone="brand">✓ Passport</Badge>}
            <BoostButton
              listingId={l.id}
              listingName={l.name}
              activeUntil={boosts[l.id] ?? null}
            />
          </div>
        ))}
      </Card>

      {/* CTAs to the other sales pages (built next) */}
      <Link
        href={`/farms/${farmId}/sales/new`}
        className="mt-6 flex h-[50px] w-full items-center justify-center rounded-btn bg-brand text-[16px] font-semibold text-white transition active:scale-[0.99] active:opacity-90"
      >
        ＋ List a Harvest
      </Link>
      <Link
        href={`/farms/${farmId}/sales/market`}
        className="mt-3 flex h-[50px] w-full items-center justify-center rounded-btn bg-fill text-[16px] font-semibold text-brand transition active:scale-[0.99]"
      >
        🛒 Browse Marketplace
      </Link>
    </main>
  );
}
