"use client";

import { healthDisplay } from "@/lib/health/display";
import type { Plant } from "@/types/database";
import { useI18n } from "@/lib/i18n/LanguageProvider";

/** Bottom overlay listing the farm's active plants to attach to a tapped spot. */
export function TagEditor({
  plants,
  onPick,
  onCancel,
}: {
  plants: Plant[];
  onPick: (plant: Plant) => void;
  onCancel: () => void;
}) {
  const { t } = useI18n();
  return (
    <div className="absolute inset-x-0 bottom-0 z-30 max-h-[45%] overflow-y-auto rounded-t-card bg-card p-4 shadow-card">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[15px] font-semibold text-label">{t.tour.pickPlant}</p>
        <button
          type="button"
          onClick={onCancel}
          className="pressable rounded-full bg-fill px-3 py-1 text-[13px] font-semibold text-secondary"
        >
          {t.tour.cancel}
        </button>
      </div>
      <ul className="divide-y divide-black/5">
        {plants.map((p) => {
          const d = healthDisplay(p.health_score);
          return (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => onPick(p)}
                className="pressable flex w-full items-center gap-3 py-2.5 text-left"
              >
                <span
                  className="inline-block h-3 w-3 rounded-full"
                  style={{ backgroundColor: d.color }}
                  aria-hidden
                />
                <span className="flex-1 text-[14.5px] font-medium text-label">
                  {p.name}
                </span>
                <span className={`text-[12.5px] ${d.textClass}`}>{d.label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
