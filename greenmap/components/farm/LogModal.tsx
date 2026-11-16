"use client";

import { useState } from "react";
import { postJson } from "@/lib/api/client";
import {
  MAX_AMOUNT_LENGTH,
  MAX_DETAIL_LENGTH,
  MAX_NOTE_LENGTH,
} from "@/lib/farm/options";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { useI18n } from "@/lib/i18n/LanguageProvider";
import type { Plant, FertilizerCategory } from "@/types/database";

export type LogType = "water" | "fertilize" | "note";

/**
 * Quick-log sheet for Water / Fertilize / Note (Phase 5, surfaced inside the
 * plant bottom sheet — D10). Sends the form's fields to /api/plants/log; the
 * server builds the structured log (badges read its metadata, never free
 * text), recalculates the trusted health score and returns the new value, so
 * the marker + sheet update immediately.
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

    // Only the fields of the chosen log type are sent. The server decides
    // what goes into the record (lib/plant/validate.ts).
    const fields =
      type === "water"
        ? { method }
        : type === "fertilize"
          ? { fertilizerType: fertType, category, amount, pesticideUsed }
          : { text, pesticideUsed, pesticideType };

    const result = await postJson<{ score: number | null }>("/api/plants/log", {
      plantId: plant.id,
      type,
      ...fields,
    });
    if (!result.ok) {
      setError(result.error);
      setSaving(false);
      return;
    }

    setSaving(false);
    onLogged(result.data.score);
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
            maxLength={MAX_DETAIL_LENGTH}
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
              maxLength={MAX_DETAIL_LENGTH}
              placeholder={t.log.fertTypePlaceholder}
              value={fertType}
              onChange={(e) => setFertType(e.target.value)}
              autoFocus
            />
            <Input
              label={t.log.amountOptional}
              maxLength={MAX_AMOUNT_LENGTH}
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
              maxLength={MAX_NOTE_LENGTH}
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
            maxLength={MAX_DETAIL_LENGTH}
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
