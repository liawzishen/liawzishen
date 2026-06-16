"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { AIScanResultCard } from "./AIScanResultCard";
import type { ScanResult } from "@/lib/ai/validate";

type Phase = "idle" | "preview" | "scanning" | "result" | "saving";

/** Downscale + JPEG-compress a photo to <=1MB before upload. */
async function compressImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const maxDim = 1280;
  let { width, height } = bitmap;
  if (width > maxDim || height > maxDim) {
    const scale = maxDim / Math.max(width, height);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, width, height);

  for (const q of [0.8, 0.65, 0.5, 0.4]) {
    const blob = await new Promise<Blob | null>((res) =>
      canvas.toBlob(res, "image/jpeg", q)
    );
    if (blob && (blob.size <= 1_000_000 || q === 0.4)) return blob;
  }
  throw new Error("Could not process the image");
}

export function ScanUploader({
  plantId,
  farmId,
  cropType,
}: {
  plantId: string;
  farmId: string;
  cropType: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    try {
      const compressed = await compressImage(file);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setBlob(compressed);
      setPreviewUrl(URL.createObjectURL(compressed));
      setResult(null);
      setImageUrl(null);
      setPhase("preview");
    } catch {
      setError("Could not read that image. Try another photo (JPG or PNG works best).");
    }
  }

  function reset() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setBlob(null);
    setImageUrl(null);
    setResult(null);
    setError(null);
    setPhase("idle");
    if (inputRef.current) inputRef.current.value = "";
  }

  async function scan() {
    if (!blob) return;
    setError(null);
    setPhase("scanning");

    const supabase = createClient();
    const path = `${plantId}/${Date.now()}.jpg`;
    const { error: upErr } = await supabase.storage
      .from("plant-scans")
      .upload(path, blob, { contentType: "image/jpeg", upsert: true });
    if (upErr) {
      setError(`Upload failed: ${upErr.message}`);
      setPhase("preview");
      return;
    }
    const {
      data: { publicUrl },
    } = supabase.storage.from("plant-scans").getPublicUrl(path);
    setImageUrl(publicUrl);

    try {
      const res = await fetch("/api/ai/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plantId, imageUrl: publicUrl, cropType }),
      });
      const data = await res.json();
      if (!res.ok || !data?.result) throw new Error(data?.error ?? "Scan failed");
      setResult(data.result as ScanResult);
      setPhase("result");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Scan failed");
      setPhase("preview");
    }
  }

  async function save() {
    if (!result || result.error || !imageUrl) return;
    setPhase("saving");
    setError(null);
    try {
      const res = await fetch("/api/ai/save-scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plantId, imageUrl, result }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Save failed");
      router.push(`/farms/${farmId}/plants/${plantId}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
      setPhase("result");
    }
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={onPick}
        className="hidden"
      />

      {previewUrl ? (
        <div className="relative overflow-hidden rounded-card">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt="Leaf preview"
            className="aspect-square w-full object-cover"
          />
          {phase === "scanning" && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/45 text-[14px] font-medium text-white">
              Analysing…
            </div>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-card border-2 border-dashed border-tertiary bg-fill text-secondary"
        >
          <span className="text-[40px]">📷</span>
          <span className="text-[14px] font-medium">Tap to add a leaf photo</span>
          <span className="text-[12px]">Fill the frame with one leaf, in good light</span>
        </button>
      )}

      {error && (
        <p className="mt-3 rounded-input bg-critical/10 p-3 text-[14px] text-critical">
          {error}
        </p>
      )}

      {(phase === "result" || phase === "saving") && result && (
        <AIScanResultCard result={result} />
      )}

      <div className="mt-4 flex gap-3">
        {phase === "idle" && (
          <Button full onClick={() => inputRef.current?.click()}>
            Add Photo
          </Button>
        )}
        {phase === "preview" && (
          <>
            <Button variant="fill" full onClick={reset}>
              Retake
            </Button>
            <Button full onClick={scan}>
              Scan Leaf
            </Button>
          </>
        )}
        {phase === "scanning" && (
          <Button full disabled>
            Analysing…
          </Button>
        )}
        {(phase === "result" || phase === "saving") &&
          (result?.error ? (
            <Button full onClick={reset}>
              Try Again
            </Button>
          ) : (
            <>
              <Button variant="fill" full onClick={reset} disabled={phase === "saving"}>
                Scan Again
              </Button>
              <Button full onClick={save} disabled={phase === "saving"}>
                {phase === "saving" ? "Saving…" : "Save to Plant Record"}
              </Button>
            </>
          ))}
      </div>
    </div>
  );
}
