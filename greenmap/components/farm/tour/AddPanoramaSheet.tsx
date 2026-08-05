"use client";

import { useRef, useState } from "react";
import type { Farm } from "@/types/database";
import { useI18n } from "@/lib/i18n/LanguageProvider";

const MAX_BYTES = 12 * 1024 * 1024;

/**
 * Upload a 360° photo: pick file → aspect sanity check (warn, don't block)
 * → tap the mini-map where you stood → save. The mini-map is a plain div
 * (no konva) with the farm photo or the smart-background gradient.
 */
export function AddPanoramaSheet({
  farm,
  onSave,
  onClose,
}: {
  farm: Farm;
  onSave: (input: {
    file: File;
    position_x: number;
    position_y: number;
  }) => Promise<boolean>;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [warn, setWarn] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [spot, setSpot] = useState<{ x: number; y: number } | null>(null);
  const [busy, setBusy] = useState(false);

  function pickFile(f: File | null) {
    setWarn(null);
    setError(null);
    if (!f) return;
    if (f.size > MAX_BYTES) {
      setError(t.tour.photoTooBig);
      return;
    }
    const url = URL.createObjectURL(f);
    const img = new Image();
    img.onload = () => {
      const ratio = img.naturalWidth / img.naturalHeight;
      if (Math.abs(ratio - 2) > 0.2) setWarn(t.tour.notPanorama);
      URL.revokeObjectURL(url);
    };
    img.src = url;
    setFile(f);
  }

  async function save() {
    if (!file || !spot || busy) return;
    setBusy(true);
    const ok = await onSave({ file, position_x: spot.x, position_y: spot.y });
    setBusy(false);
    if (!ok) setError(t.tour.loadFailed);
  }

  const hasBg =
    farm.background_url &&
    (farm.background_type === "upload" || farm.background_type === "satellite");

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 lg:items-center">
      <div className="w-full max-w-[430px] rounded-t-card bg-card p-5 shadow-card lg:rounded-card">
        <p className="mb-3 text-[16px] font-semibold text-label">
          {t.tour.addPhoto}
        </p>

        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="pressable w-full rounded-card border border-dashed border-black/20 bg-fill px-4 py-3 text-[14px] font-medium text-secondary"
        >
          {file ? file.name : t.tour.addFirstHow}
        </button>
        <p className="mt-1.5 text-[11.5px] text-secondary">{t.tour.sizeHint}</p>

        {warn && <p className="mt-2 text-[12.5px] text-warning-ink">{warn}</p>}
        {error && <p className="mt-2 text-[12.5px] text-critical-ink">{error}</p>}

        {file && (
          <>
            <p className="mb-1.5 mt-4 text-[13.5px] font-medium text-secondary">
              {t.tour.whereStood}
            </p>
            <div
              className="relative w-full cursor-crosshair overflow-hidden rounded-card"
              style={{
                aspectRatio: `${farm.canvas_width} / ${farm.canvas_height}`,
                background: hasBg
                  ? undefined
                  : "linear-gradient(135deg, #DFF5E1, #C9EAD0)",
              }}
              onClick={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                setSpot({
                  x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)),
                  y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)),
                });
              }}
            >
              {hasBg && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={farm.background_url!}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover"
                  draggable={false}
                />
              )}
              {spot && (
                <span
                  className="absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-brand shadow-card"
                  style={{
                    left: `${spot.x * 100}%`,
                    top: `${spot.y * 100}%`,
                  }}
                />
              )}
            </div>
          </>
        )}

        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="pressable flex-1 rounded-card bg-fill px-4 py-2.5 text-[14px] font-semibold text-secondary"
          >
            {t.tour.cancel}
          </button>
          <button
            type="button"
            disabled={!file || !spot || busy}
            onClick={() => void save()}
            className="pressable flex-1 rounded-card bg-brand px-4 py-2.5 text-[14px] font-bold text-white disabled:opacity-50"
          >
            {busy ? t.tour.uploading : t.tour.save}
          </button>
        </div>
      </div>
    </div>
  );
}
