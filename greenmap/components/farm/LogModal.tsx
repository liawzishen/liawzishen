"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import type {
  Plant,
  EventType,
  FertilizerCategory,
  GrowthLogMetadata,
} from "@/types/database";

export type LogType = "water" | "fertilize" | "note";

const TITLES: Record<LogType, string> = {
  water: "Log Water",
  fertilize: "Log Fertilizer",
  note: "Add Note",
};

/**
 * Quick-log sheet for Water / Fertilize / Note (Phase 5, surfaced inside the
 * plant bottom sheet — D10). Inserts a growth_logs row with structured
 * metadata (badges read metadata, never free text), then asks the server to
 * recalculate the trusted health score and reports the new value back so the
 * marker + sheet update immediately.
 */
export function LogModal({
  plant,
  type,
  onClose,
  onLogged,
}: {
  plant: Plant;
  type: LogType;
  onClose: () => void;
  onLogged: (newScore: number | null) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // water
  const [method, setMethod] = useState("");
  // fertilize
  const [fertType, setFertType] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<FertilizerCategory>("unknown");
  // note
  const [text, setText] = useState("");
  // shared (fertilize + note)
  const [pesticideUsed, setPesticideUsed] = useState(false);
  const [pesticideType, setPesticideType] = useState("");

  const valid = type !== "note" || text.trim().length > 0;

  async function save() {
    if (!valid || saving) return;
    setError(null);
    setSaving(true);

    let note: string | null = null;
    let metadata: GrowthLogMetadata = {};

    if (type === "water") {
      note = "Watered";
      metadata = method.trim() ? { method: method.trim() } : {};
    } else if (type === "fertilize") {
      note = fertType.trim() ? `Fertilized · ${fertType.trim()}` : "Fertilized";
      metadata = {
        fertilizer_type: fertType.trim() || undefined,
        fertilizer_category: category,
        amount: amount.trim() || undefined,
        pesticide_used: pesticideUsed,
      };
    } else {
      note = text.trim();
      metadata = pesticideUsed
        ? {
            pesticide_used: true,
            ...(pesticideType.trim()
              ? { pesticide_type: pesticideType.trim() }
              : {}),
          }
        : { pesticide_used: false };
    }

    const supabase = createClient();
    const { error: logErr } = await supabase.from("growth_logs").insert({
      plant_id: plant.id,
      event_type: type as EventType,
      note,
      metadata,
    });
    if (logErr) {
      setError(logErr.message);
      setSaving(false);
      return;
    }

    // Recompute the trusted score (the route also snapshots history). A failed
    // refresh is non-fatal — the log is already saved.
    let newScore: number | null = null;
    try {
      const res = await fetch("/api/health/recalculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plantId: plant.id }),
      });
      const data = await res.json();
      if (typeof data?.score === "number") newScore = data.score;
    } catch {
      // ignore — keep newScore null
    }

    setSaving(false);
    onLogged(newScore);
    onClose();
  }

  return (
    <BottomSheet open onClose={onClose} ariaLabel={TITLES[type]}>
      <h2 className="text-[20px] font-bold">{TITLES[type]}</h2>
      <p className="mt-0.5 text-[13px] text-secondary">{plant.name}</p>

      <div className="mt-4 space-y-4">
        {type === "water" && (
          <Input
            label="Method (optional)"
            placeholder="e.g. Drip, Manual"
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            autoFocus
          />
        )}

        {type === "fertilize" && (
          <>
            <Input
              label="Fertilizer Type"
              placeholder="e.g. NPK 15-15-15"
              value={fertType}
              onChange={(e) => setFertType(e.target.value)}
              autoFocus
            />
            <Input
              label="Amount (optional)"
              placeholder="e.g. 50g"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <Select
              label="Category"
              value={category}
              onChange={(e) =>
                setCategory(e.target.value as FertilizerCategory)
              }
            >
              <option value="unknown">Unknown</option>
              <option value="organic">Organic</option>
              <option value="chemical">Chemical</option>
            </Select>
          </>
        )}

        {type === "note" && (
          <div>
            <label
              htmlFor="note-text"
              className="mb-1.5 block text-[12px] font-semibold uppercase tracking-wide text-secondary"
            >
              Note
            </label>
            <textarea
              id="note-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={3}
              autoFocus
              placeholder="What did you notice?"
              className="w-full rounded-input bg-fill px-4 py-3 text-[16px] text-label placeholder:text-secondary focus:outline-none focus:ring-2 focus:ring-brand/50"
            />
          </div>
        )}

        {(type === "fertilize" || type === "note") && (
          <label className="flex items-center gap-3 text-[15px]">
            <input
              type="checkbox"
              checked={pesticideUsed}
              onChange={(e) => setPesticideUsed(e.target.checked)}
              className="h-5 w-5 accent-brand"
            />
            <span>Pesticide used</span>
          </label>
        )}

        {type === "note" && pesticideUsed && (
          <Input
            label="Pesticide Type"
            placeholder="e.g. Neem oil spray"
            value={pesticideType}
            onChange={(e) => setPesticideType(e.target.value)}
          />
        )}
      </div>

      {error && (
        <p className="mt-3 rounded-input bg-critical/10 p-3 text-[14px] text-critical">
          {error}
        </p>
      )}

      <div className="mt-5 flex gap-3">
        <Button variant="fill" full onClick={onClose}>
          Cancel
        </Button>
        <Button full onClick={save} disabled={!valid || saving}>
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>
    </BottomSheet>
  );
}
