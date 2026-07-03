"use client";

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
  const { name, location, size, cropType, update } = useFarmSetup();

  const valid =
    name.trim().length >= 2 && location !== "" && cropType.trim().length >= 2;

  function next() {
    if (!valid) return;
    router.push("/farms/new/map");
  }

  return (
    <main className="pb-28">
      <TopNav title="Set Up Farm" backHref="/farms" />
      <StepDots step={1} />

      <div className="px-6 pt-2">
        <h1 className="text-[28px] font-bold leading-tight">Farm Profile</h1>
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

          <div>
            <p className="mb-1.5 text-[12px] font-semibold uppercase tracking-wide text-secondary">
              Farm Size
            </p>
            <div className="grid grid-cols-3 gap-3">
              {SIZE_OPTIONS.map((opt) => {
                const selected = size === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => update({ size: opt.value })}
                    aria-pressed={selected}
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
          </div>

          <Input
            label="Main Crop"
            placeholder="e.g. Tomato, Chili, Pineapple"
            value={cropType}
            onChange={(e) => update({ cropType: e.target.value })}
            maxLength={40}
          />
        </div>
      </div>

      {/* Sticky footer CTA */}
      <div className="fixed bottom-0 left-1/2 w-full max-w-[430px] -translate-x-1/2 px-6 py-4 glass-strong">
        <Button full disabled={!valid} onClick={next}>
          Next: Choose Map
        </Button>
      </div>
    </main>
  );
}
