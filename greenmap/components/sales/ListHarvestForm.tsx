"use client";

import { useId, useRef, useState } from "react";
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

  const availabilityLabelId = useId();
  const fulfilmentHintId = useId();
  const availabilityRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // A listing with neither fulfilment option is unbuyable, which is why the
  // CTA is disabled — but the reason has to be said out loud (see the hint).
  const canList = pickup || delivery;

  /** Arrow keys move between availability options and select as they go
   *  (APG radiogroup); the group itself stays a single tab stop. */
  function moveAvailability(index: number) {
    const next = (index + AVAILABILITY.length) % AVAILABILITY.length;
    setAvailability(AVAILABILITY[next]);
    availabilityRefs.current[next]?.focus();
  }

  function onAvailabilityKeyDown(e: React.KeyboardEvent, index: number) {
    switch (e.key) {
      case "ArrowRight":
      case "ArrowDown":
        e.preventDefault();
        moveAvailability(index + 1);
        break;
      case "ArrowLeft":
      case "ArrowUp":
        e.preventDefault();
        moveAvailability(index - 1);
        break;
      case "Home":
        e.preventDefault();
        moveAvailability(0);
        break;
      case "End":
        e.preventDefault();
        moveAvailability(AVAILABILITY.length - 1);
        break;
    }
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canList) return;
    setListed(true);
  }

  if (listed) {
    return (
      <div className="px-6 pt-10 text-center">
        <div
          aria-hidden="true"
          className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-brand/15 text-[32px]"
        >
          🎉
        </div>
        {/* The form is replaced in place, so nothing moves focus — the
            outcome has to be announced instead. */}
        <div role="status">
          <h2 className="mt-4 text-[22px] font-bold">Listed!</h2>
          <p className="mt-1.5 text-[15px] leading-relaxed text-secondary">
            <b>{product}</b> is now on the marketplace. Buyers near you see your{" "}
            <span className="font-semibold text-brand-dark">✓ Passport</span>{" "}
            badge first.
          </p>
        </div>
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
    // A real <form>: the fields were plain <div>s, so Enter in "Price / kg"
    // did nothing at all. Button defaults to type="button", hence the
    // explicit type="submit" on the CTA below.
    <form className="px-6 pb-28 pt-2" onSubmit={onSubmit}>
      <p className="text-[15px] text-secondary">
        List your harvest on the marketplace. Details are filled in from its
        Harvest Passport.
      </p>

      {/* Auto-filled passport card */}
      <Card className="mt-4 bg-brand/5">
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-input bg-brand/15 text-[20px]"
          >
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

        {/* Three buttons picking ONE value = a radiogroup. As plain buttons
            the group had no name and the choice was signalled by the green
            fill alone, so nothing was exposed to assistive tech. */}
        <fieldset role="radiogroup" aria-labelledby={availabilityLabelId}>
          <legend
            id={availabilityLabelId}
            className="mb-1.5 text-[12px] font-semibold uppercase tracking-wide text-secondary"
          >
            Availability
          </legend>
          <div className="flex gap-2">
            {AVAILABILITY.map((a, i) => {
              const selected = availability === a;
              return (
                <button
                  key={a}
                  ref={(el) => {
                    availabilityRefs.current[i] = el;
                  }}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  tabIndex={selected ? 0 : -1}
                  onClick={() => setAvailability(a)}
                  onKeyDown={(e) => onAvailabilityKeyDown(e, i)}
                  className={cn(
                    "flex-1 rounded-input px-3 py-2.5 text-[14px] transition active:scale-[0.98]",
                    // Weight, not just hue, marks the choice.
                    selected
                      ? "bg-brand font-semibold text-white"
                      : "bg-fill font-medium text-label"
                  )}
                >
                  {a}
                </button>
              );
            })}
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-1.5 text-[12px] font-semibold uppercase tracking-wide text-secondary">
            Fulfilment
          </legend>
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
        </fieldset>
      </div>

      {/* Sticky submit */}
      <div className="fixed bottom-0 left-1/2 w-full max-w-[430px] -translate-x-1/2 px-6 py-4 glass-strong">
        {/* A silently disabled CTA is a dead end — say what unlocks it. */}
        {!canList && (
          <p
            id={fulfilmentHintId}
            className="mb-2 text-center text-[12px] text-secondary"
          >
            Turn on pickup or delivery so buyers know how to get it.
          </p>
        )}
        <Button
          type="submit"
          full
          disabled={!canList}
          aria-describedby={canList ? undefined : fulfilmentHintId}
        >
          List for Sale
        </Button>
      </div>
    </form>
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
    // Two independent on/off choices, so each row is a checkbox — not a
    // radio, and not an unlabelled button. Without aria-checked the only
    // signal that a fulfilment method was selected was a green circle.
    <button
      type="button"
      role="checkbox"
      aria-checked={on}
      onClick={onToggle}
      className="flex w-full items-center gap-3 rounded-input bg-fill p-3 text-left transition active:opacity-80"
    >
      <span
        aria-hidden="true"
        className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/50 text-[17px]"
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-medium">{title}</p>
        <p className="text-[12px] text-secondary">{sub}</p>
      </div>
      {/*
        The tick used to stay in the DOM when off, merely painted
        transparent — so a screen reader read a checkmark on an UNCHECKED
        row. It is now aria-hidden decoration on top of aria-checked, and
        the empty state is an empty ring rather than an invisible glyph.
      */}
      <span
        aria-hidden="true"
        className={cn(
          "grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 text-[13px]",
          on ? "border-brand bg-brand text-white" : "border-tertiary"
        )}
      >
        {on ? "✓" : ""}
      </span>
    </button>
  );
}
