"use client";

import { useI18n } from "@/lib/i18n/LanguageProvider";

/**
 * Shown in 3D mode when the farm has no panoramas yet (or the table is
 * missing — migration 0009 not run). The "Add 360° photo" button appears
 * once FarmTour passes onAddPhoto (upload flow).
 */
export function TourEmptyState({
  notSetUp,
  onAddPhoto,
}: {
  notSetUp: boolean;
  onAddPhoto?: () => void;
}) {
  const { t } = useI18n();
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-[#1c241c] px-8 text-center">
      <span className="text-[40px]" aria-hidden>
        📷
      </span>
      <p className="text-[17px] font-semibold text-white">{t.tour.addFirst}</p>
      <p className="max-w-[320px] text-[13.5px] leading-relaxed text-white/70">
        {t.tour.addFirstHow}
      </p>
      {notSetUp && (
        <p className="max-w-[320px] rounded-card bg-white/10 px-3 py-2 text-[12.5px] text-amber-200">
          {t.tour.notSetUp}
        </p>
      )}
      {onAddPhoto && (
        <button
          type="button"
          onClick={onAddPhoto}
          className="pressable mt-2 rounded-full bg-brand px-5 py-2.5 text-[14px] font-bold text-white shadow-card"
        >
          {t.tour.addPhoto}
        </button>
      )}
    </div>
  );
}
