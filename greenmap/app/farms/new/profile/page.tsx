"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useFarmSetup } from "@/contexts/farm-setup-context";
import { TopNav } from "@/components/layout/TopNav";
import { StepDots } from "@/components/layout/StepDots";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import type { FarmSize } from "@/types/database";

/** 16 Malaysian states + federal territories. */
const MALAYSIAN_STATES = [
  "Johor",
  "Kedah",
  "Kelantan",
  "Melaka",
  "Negeri Sembilan",
  "Pahang",
  "Perak",
  "Perlis",
  "Pulau Pinang",
  "Sabah",
  "Sarawak",
  "Selangor",
  "Terengganu",
  "Kuala Lumpur",
  "Labuan",
  "Putrajaya",
];

const SIZE_OPTIONS: { value: FarmSize; label: string; hint: string }[] = [
  { value: "small", label: "Small", hint: "< 1 acre" },
  { value: "medium", label: "Medium", hint: "1–5 acres" },
  { value: "large", label: "Large", hint: "> 5 acres" },
];

export default function SetupProfilePage() {
  const router = useRouter();
  const { name, location, latitude, longitude, size, cropType, update } =
    useFarmSetup();
  const [pinning, setPinning] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);
  // Roving tabindex for the size radiogroup: the group is one tab stop and
  // the arrow keys move focus with the selection (APG radiogroup).
  const sizeRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const valid =
    name.trim().length >= 2 && location !== "" && cropType.trim().length >= 2;

  /** Optional GPS pin — the weather panel then forecasts the exact field. */
  function pinLocation() {
    setPinError(null);
    if (!("geolocation" in navigator)) {
      setPinError("This device doesn't support location.");
      return;
    }
    setPinning(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        update({
          latitude: Number(pos.coords.latitude.toFixed(5)),
          longitude: Number(pos.coords.longitude.toFixed(5)),
        });
        setPinning(false);
      },
      () => {
        setPinError("Couldn't get your location — check the permission and try again.");
        setPinning(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  function selectSizeAt(index: number) {
    const i = (index + SIZE_OPTIONS.length) % SIZE_OPTIONS.length;
    update({ size: SIZE_OPTIONS[i].value });
    sizeRefs.current[i]?.focus();
  }

  function onSizeKeyDown(e: React.KeyboardEvent, index: number) {
    switch (e.key) {
      case "ArrowRight":
      case "ArrowDown":
        e.preventDefault();
        selectSizeAt(index + 1);
        break;
      case "ArrowLeft":
      case "ArrowUp":
        e.preventDefault();
        selectSizeAt(index - 1);
        break;
      case "Home":
        e.preventDefault();
        selectSizeAt(0);
        break;
      case "End":
        e.preventDefault();
        selectSizeAt(SIZE_OPTIONS.length - 1);
        break;
    }
  }

  function next(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    router.push("/farms/new/map");
  }

  return (
    <main
      id="main-content"
      className="desktop-breakout pb-28 lg:mx-auto lg:w-full lg:max-w-[720px]"
    >
      <TopNav title="Set Up Farm" backHref="/farms" />
      <StepDots step={1} />

      {/* A real <form>, so Enter in any field advances the wizard instead of
          doing nothing. TopNav's "Set Up Farm" is the <h1>; the step is an
          <h2> under it. */}
      <form onSubmit={next}>
      <div className="px-6 pt-2">
        <h2 className="text-[28px] font-bold leading-tight">Farm Profile</h2>
        <p className="mt-1 text-[15px] text-secondary">
          Tell us about your farm. You can change these later.
        </p>

        <div className="mt-6 space-y-4">
          <Input
            label="Farm Name"
            placeholder="e.g. Ladang Hijau"
            value={name}
            onChange={(e) => update({ name: e.target.value })}
            maxLength={60}
          />

          <Select
            label="State"
            value={location}
            onChange={(e) => update({ location: e.target.value })}
          >
            <option value="" disabled>
              Select a state…
            </option>
            {MALAYSIAN_STATES.map((state) => (
              <option key={state} value={state}>
                {state}
              </option>
            ))}
          </Select>

          {/* Optional GPS pin → exact weather for the farm's own spot */}
          <div className="rounded-input bg-fill p-3">
            {latitude !== null && longitude !== null ? (
              <div className="flex items-center justify-between gap-3">
                {/* The pin lands without moving focus, so it has to be spoken. */}
                <p role="status" className="min-w-0 text-[13px] font-medium">
                  <span aria-hidden>📍</span> Farm pinned{" "}
                  <span className="text-secondary">
                    ({latitude}, {longitude})
                  </span>
                </p>
                <button
                  type="button"
                  onClick={() => update({ latitude: null, longitude: null })}
                  className="shrink-0 px-1 py-1 text-[13px] font-semibold text-critical-ink"
                >
                  Remove
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={pinLocation}
                disabled={pinning}
                aria-busy={pinning || undefined}
                className="w-full text-left text-[13px] font-semibold text-brand disabled:opacity-60"
              >
                {pinning ? (
                  "Locating…"
                ) : (
                  <>
                    <span aria-hidden>📍</span> Pin my farm&apos;s GPS location
                  </>
                )}
                <span className="mt-0.5 block text-[12px] font-normal text-secondary">
                  Optional — gives you an exact weather &amp; soil forecast for
                  your farm, not just the state.
                </span>
              </button>
            )}
            {pinError && (
              <p role="alert" className="mt-1.5 text-[12px] text-critical-ink">
                {pinError}
              </p>
            )}
          </div>

          {/*
            One value out of three — a radiogroup, not three independent
            toggles. aria-pressed said "this button is on" three times over
            and never said which one the answer was.
          */}
          <fieldset role="radiogroup">
            <legend className="mb-1.5 text-[12px] font-semibold uppercase tracking-wide text-secondary">
              Farm Size
            </legend>
            <div className="grid grid-cols-3 gap-3">
              {SIZE_OPTIONS.map((opt, i) => {
                const selected = size === opt.value;
                return (
                  <button
                    key={opt.value}
                    ref={(el) => {
                      sizeRefs.current[i] = el;
                    }}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    tabIndex={selected ? 0 : -1}
                    onClick={() => update({ size: opt.value })}
                    onKeyDown={(e) => onSizeKeyDown(e, i)}
                    className={cn(
                      "rounded-input p-3 text-center transition",
                      selected
                        ? "bg-brand/10 ring-2 ring-brand"
                        : "bg-fill ring-1 ring-transparent"
                    )}
                  >
                    <span className="block text-[15px] font-semibold">
                      {opt.label}
                    </span>
                    <span className="mt-0.5 block text-[12px] text-secondary">
                      {opt.hint}
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <Input
            label="Main Crop"
            placeholder="e.g. Tomato, Chili, Pineapple"
            value={cropType}
            onChange={(e) => update({ cropType: e.target.value })}
            maxLength={40}
          />
        </div>
      </div>

      {/* Sticky footer CTA — inside the <form> so it is a real submit and
          Enter from any field advances the wizard. */}
      <div className="fixed bottom-0 left-1/2 w-full max-w-[430px] -translate-x-1/2 px-6 py-4 glass-strong">
        <Button type="submit" full disabled={!valid}>
          Next: Choose Map
        </Button>
        {!valid && (
          <p className="mt-1.5 text-center text-[12px] text-secondary">
            Add a farm name and state to continue.
          </p>
        )}
      </div>
      </form>
    </main>
  );
}
