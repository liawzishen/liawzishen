"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useFarmSetup } from "@/contexts/farm-setup-context";
import { createClient } from "@/lib/supabase/client";
import { TopNav } from "@/components/layout/TopNav";
import { StepDots } from "@/components/layout/StepDots";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

/** 6 preset zone colours (06 spec). */
const ZONE_COLORS = [
  { name: "Green", value: "#34C759" },
  { name: "Amber", value: "#FF9F0A" },
  { name: "Blue", value: "#007AFF" },
  { name: "Red", value: "#FF3B30" },
  { name: "Purple", value: "#AF52DE" },
  { name: "Teal", value: "#30B0C7" },
];

export default function SetupZonesPage() {
  const router = useRouter();
  const setup = useFarmSetup();
  const { name, size, location, zones, addZone, removeZone } = setup;

  const [showForm, setShowForm] = useState(false);
  const [zoneName, setZoneName] = useState("");
  const [zoneColor, setZoneColor] = useState(ZONE_COLORS[0].value);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function confirmZone() {
    if (zoneName.trim().length === 0) return;
    addZone({ name: zoneName.trim(), color: zoneColor });
    setZoneName("");
    setZoneColor(ZONE_COLORS[0].value);
    setShowForm(false);
  }

  /** The one DB write of the whole wizard: farm → zones → go to dashboard. */
  async function finish() {
    setError(null);
    setSaving(true);
    const supabase = createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError("Your session expired. Please log in again.");
      setSaving(false);
      return;
    }

    // 1. Insert the farm.
    const base = {
      user_id: user.id,
      name: setup.name,
      location: setup.location,
      size: setup.size,
      crop_type: setup.cropType,
      background_type: setup.backgroundType,
      background_url: setup.backgroundUrl,
    };
    const hasPin = setup.latitude !== null && setup.longitude !== null;
    let { data: farm, error: farmError } = await supabase
      .from("farms")
      .insert({
        ...base,
        ...(hasPin
          ? { latitude: setup.latitude, longitude: setup.longitude }
          : {}),
      })
      .select()
      .single();

    // If the 0006 coordinates migration hasn't been applied yet, saving the
    // GPS pin fails on the unknown column — retry without it so farm
    // creation never breaks (weather falls back to geocoding the state).
    if (farmError && hasPin && /latitude|longitude/i.test(farmError.message)) {
      ({ data: farm, error: farmError } = await supabase
        .from("farms")
        .insert(base)
        .select()
        .single());
    }

    if (farmError || !farm) {
      setError(farmError?.message ?? "Could not create the farm.");
      setSaving(false);
      return;
    }

    // 2. Insert zones (if any) in one batch.
    if (zones.length > 0) {
      const { error: zoneError } = await supabase.from("zones").insert(
        zones.map((z) => ({
          farm_id: farm.id,
          name: z.name,
          color: z.color,
        }))
      );
      if (zoneError) {
        // Farm exists; zones failed. Tell the user but still continue.
        setError(
          "Farm created, but zones could not be saved. You can add them later."
        );
      }
    }

    // 3. Go to the new farm's dashboard.
    setup.reset();
    router.push(`/farms/${farm.id}`);
  }

  return (
    <main className="desktop-breakout pb-28 lg:mx-auto lg:w-full lg:max-w-[720px]">
      <TopNav title="Set Up Farm" backHref="/farms/new/map" />
      <StepDots step={3} />

      <div className="px-6 pt-2">
        <h1 className="text-[28px] font-bold leading-tight">Almost Done!</h1>
        <p className="mt-1 text-[15px] text-secondary">
          Add optional zones to organise your plants, or skip for now.
        </p>

        {/* Read-only farm summary */}
        <div className="mt-5 flex items-center gap-3 rounded-card p-4 glass">
          <div
            aria-hidden
            className="h-12 w-16 shrink-0 overflow-hidden rounded-input"
            style={{
              background: "linear-gradient(135deg,#DFF5E1,#C9EAD0)",
            }}
          />
          <div>
            <p className="text-[15px] font-semibold">{name || "Your farm"}</p>
            <p className="text-[13px] capitalize text-secondary">
              {size} · {location}
            </p>
          </div>
        </div>

        {/* Zone chips */}
        {zones.length > 0 && (
          <ul className="mt-4 space-y-2">
            {zones.map((z, i) => (
              <li
                key={`${z.name}-${i}`}
                className="flex items-center gap-2 rounded-input bg-fill px-3 py-2.5"
              >
                <span
                  aria-hidden
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: z.color }}
                />
                <span className="flex-1 text-[15px]">{z.name}</span>
                <button
                  type="button"
                  onClick={() => removeZone(i)}
                  aria-label={`Remove ${z.name}`}
                  className="text-secondary"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}

        {/* Add-zone mini-form */}
        {showForm ? (
          <div className="mt-4 rounded-card p-4 glass">
            <Input
              label="Zone Name"
              placeholder="e.g. Tomato Rows"
              value={zoneName}
              onChange={(e) => setZoneName(e.target.value)}
              autoFocus
            />
            <p className="mb-1.5 mt-3 text-[12px] font-semibold uppercase tracking-wide text-secondary">
              Colour
            </p>
            <div className="flex gap-2.5">
              {ZONE_COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setZoneColor(c.value)}
                  aria-label={c.name}
                  className={cn(
                    "h-8 w-8 rounded-full transition",
                    zoneColor === c.value &&
                      "ring-2 ring-label ring-offset-2"
                  )}
                  style={{ backgroundColor: c.value }}
                />
              ))}
            </div>
            <div className="mt-4 flex gap-2">
              <Button
                variant="fill"
                size="sm"
                onClick={() => setShowForm(false)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={confirmZone}
                disabled={zoneName.trim().length === 0}
              >
                Add Zone
              </Button>
            </div>
          </div>
        ) : (
          zones.length < 8 && (
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="mt-4 w-full rounded-card border-2 border-dashed border-tertiary py-3 text-[15px] font-medium text-brand"
            >
              + Add Zone
            </button>
          )
        )}

        {error && (
          <p className="mt-4 rounded-input bg-critical/10 p-3 text-[14px] text-critical">
            {error}
          </p>
        )}
      </div>

      {/* Sticky footer: the finish action */}
      <div className="fixed bottom-0 left-1/2 w-full max-w-[430px] -translate-x-1/2 px-6 py-4 glass-strong">
        <Button full onClick={finish} disabled={saving}>
          {saving
            ? "Creating your farm…"
            : zones.length > 0
              ? "Enter My Farm"
              : "Skip & Enter My Farm"}
        </Button>
      </div>
    </main>
  );
}
