"use client";

import { useState } from "react";
import { postJson } from "@/lib/api/client";
import { MAX_PLANT_NAME_LENGTH } from "@/lib/farm/options";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import type { Plant, Zone } from "@/types/database";

interface Props {
  farmId: string;
  zones: Zone[];
  position: { x: number; y: number }; // 0–1 fractions
  onCancel: () => void;
  onCreated: (plant: Plant) => void;
}

/**
 * Modal shown after the grower taps a spot in placement mode.
 * /api/plants adds the plant (no score yet → grey "New") plus a 'planted' log.
 */
export function AddPlantModal({
  farmId,
  zones,
  position,
  onCancel,
  onCreated,
}: Props) {
  const [name, setName] = useState("");
  const [type, setType] = useState("");
  const [zoneId, setZoneId] = useState("");
  const [harvestDate, setHarvestDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid = name.trim().length >= 1 && type.trim().length >= 1;

  async function save() {
    if (!valid) return;
    setError(null);
    setSaving(true);

    // One request: the server adds the plant and its "planted" log entry.
    const result = await postJson<{ plant: Plant }>("/api/plants", {
      farmId,
      zoneId: zoneId || null,
      name: name.trim(),
      type: type.trim(),
      expectedHarvestDate: harvestDate || null,
      position,
    });
    if (!result.ok) {
      setError(result.error);
      setSaving(false);
      return;
    }

    onCreated(result.data.plant);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-md">
      <div className="w-full max-w-[430px] rounded-t-[26px] glass-sheet p-6 pb-8">
        <h2 className="text-[20px] font-bold">Add Plant</h2>
        <p className="mt-0.5 text-[13px] text-secondary">
          New plants start as “New” until their first health check.
        </p>

        <div className="mt-4 space-y-4">
          <Input
            label="Plant Name"
            maxLength={MAX_PLANT_NAME_LENGTH}
            placeholder="e.g. Tomato A"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
          <Input
            label="Type"
            maxLength={MAX_PLANT_NAME_LENGTH}
            placeholder="e.g. Tomato"
            value={type}
            onChange={(e) => setType(e.target.value)}
          />
          {zones.length > 0 && (
            <Select
              label="Zone (optional)"
              value={zoneId}
              onChange={(e) => setZoneId(e.target.value)}
            >
              <option value="">No zone</option>
              {zones.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.name}
                </option>
              ))}
            </Select>
          )}
          <Input
            label="Expected Harvest (optional)"
            type="date"
            value={harvestDate}
            onChange={(e) => setHarvestDate(e.target.value)}
          />
        </div>

        {error && (
          <p className="mt-3 rounded-input bg-critical/10 p-3 text-[14px] text-critical">
            {error}
          </p>
        )}

        <div className="mt-5 flex gap-3">
          <Button variant="fill" full onClick={onCancel}>
            Cancel
          </Button>
          <Button full onClick={save} disabled={!valid || saving}>
            {saving ? "Adding…" : "Add Plant"}
          </Button>
        </div>
      </div>
    </div>
  );
}
