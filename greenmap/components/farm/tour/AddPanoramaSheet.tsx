"use client";

import { useRef, useState } from "react";
import type { Farm } from "@/types/database";
import { useI18n } from "@/lib/i18n/LanguageProvider";
import { preparePanoUpload } from "./panoImage";

/** Largest file that is uploaded (after the photo has been optimised). */
const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;
/** Largest original we try to open; bigger ones can exhaust a phone's memory. */
const MAX_ORIGINAL_BYTES = 60 * 1024 * 1024;

const megabytes = (bytes: number) => `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

/**
 * Upload a 360° photo: pick file → resize/compress in the browser → aspect
 * sanity check (warn, don't block) → tap the mini-map where you stood → save.
 * The mini-map is a plain div (no konva) with the farm photo or the
 * smart-background gradient.
 */
export function AddPanoramaSheet({
  farm,
  onSave,
  onClose,
}: {
  farm: Farm;
  onSave: (input: {
    file: Blob;
    position_x: number;
    position_y: number;
  }) => Promise<boolean>;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const fileRef = useRef<HTMLInputElement>(null);
  // The photo that will be uploaded (already resized/compressed).
  const [file, setFile] = useState<{ name: string; blob: Blob } | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [savedNote, setSavedNote] = useState<string | null>(null);
  const [warn, setWarn] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [spot, setSpot] = useState<{ x: number; y: number } | null>(null);
  const [busy, setBusy] = useState(false);
  // The latest pick — an earlier file's slow decode must not overwrite it.
  const pickedRef = useRef<File | null>(null);

  async function pickFile(picked: File | null) {
    if (!picked) return;
    pickedRef.current = picked;
    setWarn(null);
    setError(null);
    setSavedNote(null);
    // Don't leave an earlier pick armed (Save enabled) while this one is
    // being prepared, or behind an error.
    setFile(null);
    if (picked.size > MAX_ORIGINAL_BYTES) {
      setPreparing(false);
      setError(t.tour.photoTooBig);
      return;
    }

    setPreparing(true);
    let blob: Blob = picked;
    let ratio: number | null = null;
    let note: string | null = null;
    try {
      const prepared = await preparePanoUpload(picked);
      blob = prepared.blob;
      ratio = prepared.width / prepared.height;
      if (prepared.optimized) {
        note = t.tour.optimized(megabytes(picked.size), megabytes(blob.size));
      }
    } catch (err) {
      // The browser could not decode it here: upload the original untouched.
      console.warn("[tour] photo could not be optimised:", err);
    }
    if (pickedRef.current !== picked) return; // a newer pick took over
    setPreparing(false);

    if (blob.size > MAX_UPLOAD_BYTES) {
      setError(t.tour.photoTooBig);
      return;
    }
    if (ratio !== null && Math.abs(ratio - 2) > 0.2) setWarn(t.tour.notPanorama);
    setSavedNote(note);
    setFile({ name: picked.name, blob });
  }

  async function save() {
    if (!file || !spot || busy) return;
    setBusy(true);
    setError(null);
    let ok = false;
    try {
      ok = await onSave({
        file: file.blob,
        position_x: spot.x,
        position_y: spot.y,
      });
    } catch (err) {
      console.warn("[tour] panorama save failed:", err);
    } finally {
      setBusy(false);
    }
    if (!ok) setError(t.tour.uploadFailed);
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
          onChange={(e) => {
            void pickFile(e.target.files?.[0] ?? null);
            e.target.value = ""; // re-picking the same file must fire again
          }}
        />
        <button
          type="button"
          disabled={preparing || busy}
          onClick={() => fileRef.current?.click()}
          className="pressable w-full rounded-card border border-dashed border-black/20 bg-fill px-4 py-3 text-[14px] font-medium text-secondary disabled:opacity-60"
        >
          {preparing
            ? t.tour.preparing
            : file
              ? file.name
              : t.tour.addFirstHow}
        </button>
        <p className="mt-1.5 text-[11.5px] text-secondary">
          {savedNote ?? t.tour.sizeHint}
        </p>

        {warn && <p className="mt-2 text-[12.5px] text-warning">{warn}</p>}
        {error && (
          <p role="alert" className="mt-2 text-[12.5px] text-critical">
            {error}
          </p>
        )}

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
                // object-fill, not cover: the 2D Konva map stretches the
                // background to the canvas, so the tapped fraction must map
                // onto the same stretched image or badges land elsewhere.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={farm.background_url!}
                  alt=""
                  className="absolute inset-0 h-full w-full object-fill"
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
