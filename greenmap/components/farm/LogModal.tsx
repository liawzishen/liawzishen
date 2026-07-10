"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { useI18n } from "@/lib/i18n/LanguageProvider";
import type {
  Plant,
  EventType,
  FertilizerCategory,
  GrowthLogMetadata,
} from "@/types/database";

export type LogType = "water" | "fertilize" | "note";

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
  const { t } = useI18n();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const titles: Record<LogType, string> = {
    water: t.log.waterTitle,
    fertilize: t.log.fertilizeTitle,
    note: t.log.noteTitle,
  };

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
      // No note — the event type already says "watered"; a repeating note
      // rendered as "Watered Watered" in the feeds.
      note = null;
      metadata = method.trim() ? { method: method.trim() } : {};
    } else if (type === "fertilize") {
      note = fertType.trim() || null; // the fertilizer name IS the useful note
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
    <BottomSheet open onClose={onClose} ariaLabel={titles[type]}>
      <h2 className="text-[20px] font-bold">{titles[type]}</h2>
      <p className="mt-0.5 text-[13px] text-secondary">{plant.name}</p>

      <div className="mt-4 space-y-4">
        {type === "water" && (
          <Input
            label={t.log.methodOptional}
            placeholder={t.log.methodPlaceholder}
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            autoFocus
          />
        )}

        {type === "fertilize" && (
          <>
            <Input
              label={t.log.fertType}
              placeholder={t.log.fertTypePlaceholder}
              value={fertType}
              onChange={(e) => setFertType(e.target.value)}
              autoFocus
            />
            <Input
              label={t.log.amountOptional}
              placeholder={t.log.amountPlaceholder}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <Select
              label={t.log.category}
              value={category}
              onChange={(e) =>
                setCategory(e.target.value as FertilizerCategory)
              }
            >
              <option value="unknown">{t.log.catUnknown}</option>
              <option value="organic">{t.log.catOrganic}</option>
              <option value="chemical">{t.log.catChemical}</option>
            </Select>
          </>
        )}

        {type === "note" && (
          <div>
            <label
              htmlFor="note-text"
              className="mb-1.5 block text-[12px] font-semibold uppercase tracking-wide text-secondary"
            >
              {t.log.note}
            </label>
            <textarea
              id="note-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={3}
              autoFocus
              placeholder={t.log.notePlaceholder}
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
            <span>{t.log.pesticideUsed}</span>
          </label>
        )}

        {type === "note" && pesticideUsed && (
          <Input
            label={t.log.pesticideType}
            placeholder={t.log.pesticideTypePlaceholder}
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
          {t.log.cancel}
        </Button>
        <Button full onClick={save} disabled={!valid || saving}>
          {saving ? t.log.saving : t.log.save}
        </Button>
      </div>
    </BottomSheet>
  );
}
