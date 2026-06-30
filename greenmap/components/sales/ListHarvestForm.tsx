"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

/**
 * Simulated "List a Harvest" flow (Phase-3 preview). Auto-fills from a Harvest
 * Passport, lets the grower set price / availability / fulfilment, and shows a
 * mock "Listed!" success. No persistence, no payment.
 */

const AVAILABILITY = ["3 days", "1 week", "Custom"];

export function ListHarvestForm({ farmId }: { farmId: string }) {
  const [product, setProduct] = useState("Organic Cherry Tomatoes");
  const [quantity, setQuantity] = useState("20 kg");
  const [price, setPrice] = useState("RM 8.00");
  const [availability, setAvailability] = useState("3 days");
  const [pickup, setPickup] = useState(true);
  const [delivery, setDelivery] = useState(true);
  const [listed, setListed] = useState(false);

  if (listed) {
    return (
      <div className="px-6 pt-10 text-center">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-brand/15 text-[32px]">
          🎉
        </div>
        <h2 className="mt-4 text-[22px] font-bold">Listed!</h2>
        <p className="mt-1.5 text-[15px] leading-relaxed text-secondary">
          <b>{product}</b> is now on the marketplace. Buyers near you see your{" "}
          <span className="font-semibold text-brand-dark">✓ Passport</span> badge
          first.
        </p>
        <div className="mt-7 space-y-3">
          <Button href={`/farms/${farmId}/sales`} full>
            View My Sales
          </Button>
          <Button href={`/farms/${farmId}/sales/market`} variant="fill" full>
            Browse Marketplace
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="px-6 pb-28 pt-2">
      <p className="text-[15px] text-secondary">
        List your harvest on the marketplace. Details are filled in from its
        Harvest Passport.
      </p>

      {/* Auto-filled passport card */}
      <Card className="mt-4 bg-brand/5">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-input bg-brand/15 text-[20px]">
            🍅
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold">Auto-filled from Passport</p>
            <p className="text-[13px] text-secondary">
              Ladang Hijau, Johor · harvested 20 Jun · avg health 87%
            </p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Badge tone="brand">✓ Pesticide Free</Badge>
          <Badge tone="brand">✓ AI Verified</Badge>
          <Badge tone="brand">✓ Verified Grower</Badge>
        </div>
      </Card>

      {/* Form */}
      <div className="mt-5 space-y-4">
        <Input
          label="Product"
          value={product}
          onChange={(e) => setProduct(e.target.value)}
        />
        <div className="flex gap-3">
          <div className="flex-1">
            <Input
              label="Quantity"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </div>
          <div className="flex-1">
            <Input
              label="Price / kg"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </div>
        </div>

        <div>
          <p className="mb-1.5 text-[12px] font-semibold uppercase tracking-wide text-secondary">
            Availability
          </p>
          <div className="flex gap-2">
            {AVAILABILITY.map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => setAvailability(a)}
                className={cn(
                  "flex-1 rounded-input px-3 py-2.5 text-[14px] font-medium transition active:scale-[0.98]",
                  availability === a ? "bg-brand text-white" : "bg-fill text-label"
                )}
              >
                {a}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-1.5 text-[12px] font-semibold uppercase tracking-wide text-secondary">
            Fulfilment
          </p>
          <div className="space-y-2">
            <FulfilRow
              icon="📍"
              title="Self pickup"
              sub="Buyer collects from your farm"
              on={pickup}
              onToggle={() => setPickup((v) => !v)}
            />
            <FulfilRow
              icon="🛵"
              title="Farmer delivery"
              sub="Within 25 km · RM 5 flat"
              on={delivery}
              onToggle={() => setDelivery((v) => !v)}
            />
          </div>
        </div>
      </div>

      {/* Sticky submit */}
      <div className="fixed bottom-0 left-1/2 w-full max-w-[430px] -translate-x-1/2 bg-bg/85 px-6 py-4 backdrop-blur-xl">
        <Button full onClick={() => setListed(true)} disabled={!pickup && !delivery}>
          List for Sale
        </Button>
      </div>
    </div>
  );
}

function FulfilRow({
  icon,
  title,
  sub,
  on,
  onToggle,
}: {
  icon: string;
  title: string;
  sub: string;
  on: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex w-full items-center gap-3 rounded-input bg-fill p-3 text-left transition active:opacity-80"
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-card text-[17px]">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-medium">{title}</p>
        <p className="text-[12px] text-secondary">{sub}</p>
      </div>
      <span
        className={cn(
          "grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 text-[13px]",
          on ? "border-brand bg-brand text-white" : "border-tertiary text-transparent"
        )}
      >
        ✓
      </span>
    </button>
  );
}
