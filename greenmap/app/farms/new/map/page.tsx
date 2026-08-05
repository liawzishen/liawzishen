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
import type { BackgroundType } from "@/types/database";

const OPTIONS: {
  value: BackgroundType;
  icon: string;
  title: string;
  desc: string;
}[] = [
  {
    value: "smart",
    icon: "🎨",
    title: "Smart Background",
    desc: "Auto-generated stylised farm — ready instantly",
  },
  {
    value: "upload",
    icon: "📷",
    title: "Upload Photo",
    desc: "Use your own aerial photo (JPG / PNG, max 10MB)",
  },
  {
    value: "satellite",
    icon: "🛰️",
    title: "Satellite View",
    desc: "Find your farm by address — live satellite imagery",
  },
];

/** A stylised "smart" preview (no external image needed). */
function SmartPreview({ label }: { label?: string }) {
  return (
    <div
      className="relative h-full w-full"
      style={{
        background:
          "linear-gradient(135deg, #DFF5E1 0%, #C9EAD0 100%)",
        backgroundImage:
          "radial-gradient(rgba(52,199,89,0.35) 2px, transparent 2px)",
        backgroundSize: "22px 22px",
      }}
    >
      {label && (
        <span className="absolute bottom-2 left-2 rounded-full bg-white/80 px-2 py-0.5 text-[11px] font-medium text-brand-dark">
          {label}
        </span>
      )}
    </div>
  );
}

export default function SetupMapPage() {
  const router = useRouter();
  const { name, backgroundType, backgroundUrl, update } = useFarmSetup();
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [satQuery, setSatQuery] = useState("");
  const [satLoading, setSatLoading] = useState(false);
  const [satError, setSatError] = useState<string | null>(null);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setUploadError(null);

    if (file.size > 10 * 1024 * 1024) {
      setUploadError("File is larger than 10MB.");
      return;
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setUploadError("Please use a JPG, PNG or WEBP image.");
      return;
    }

    setUploading(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${user?.id ?? "anon"}/${Date.now()}.${ext}`;

    const { error } = await supabase.storage
      .from("farm-backgrounds")
      .upload(path, file, { upsert: true });

    if (error) {
      setUploadError(error.message);
      setUploading(false);
      return;
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("farm-backgrounds").getPublicUrl(path);

    update({ backgroundUrl: publicUrl });
    setUploading(false);
  }

  async function searchSatellite() {
    const q = satQuery.trim();
    if (!q) return;
    setSatError(null);
    setSatLoading(true);
    try {
      const res = await fetch("/api/satellite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSatError(data.error ?? "Could not fetch a satellite image.");
        return;
      }
      update({ backgroundType: "satellite", backgroundUrl: data.url });
    } catch {
      setSatError("Network error — please try again.");
    } finally {
      setSatLoading(false);
    }
  }

  // Upload needs a finished upload; satellite is optional (smart fallback).
  const canContinue =
    backgroundType === "upload" ? Boolean(backgroundUrl) : true;

  return (
    <main id="main-content" className="desktop-breakout pb-28 lg:mx-auto lg:w-full lg:max-w-[720px]">
      <TopNav title="Set Up Farm" backHref="/farms/new/profile" />
      <StepDots step={2} />

      <div className="px-6 pt-2">
        {/* TopNav's "Set Up Farm" is the <h1>; this step is an <h2> under it. */}
        <h2 className="text-[28px] font-bold leading-tight">Choose Your Map</h2>
        <p className="mt-1 text-[15px] text-secondary">
          Pick a background for your farm canvas.
        </p>

        {/* Option cards */}
        <div className="mt-5 space-y-3">
          {OPTIONS.map((opt) => {
            const selected = backgroundType === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() =>
                  update({ backgroundType: opt.value })
                }
                aria-pressed={selected}
                className={cn(
                  "flex w-full items-center gap-3 rounded-card p-4 text-left transition",
                  selected
                    ? "bg-brand/10 ring-2 ring-brand"
                    : "glass ring-1 ring-transparent"
                )}
              >
                <span aria-hidden className="text-[24px]">
                  {opt.icon}
                </span>
                <span className="flex-1">
                  <span className="flex items-center gap-1.5 text-[15px] font-semibold">
                    {opt.title}
                    {selected && <span className="text-brand">✓</span>}
                  </span>
                  <span className="mt-0.5 block text-[13px] leading-snug text-secondary">
                    {opt.desc}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        {/* Conditional input */}
        {backgroundType === "upload" && (
          <div className="mt-4">
            <label className="mb-1.5 block text-[12px] font-semibold uppercase tracking-wide text-secondary">
              Upload Image
            </label>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => handleFile(e.target.files?.[0])}
              className="block w-full text-[14px] text-secondary file:mr-3 file:rounded-btn file:border-0 file:bg-brand file:px-4 file:py-2 file:text-white"
            />
            {uploading && (
              <p className="mt-2 text-[13px] text-info-ink">Uploading…</p>
            )}
            {uploadError && (
              <p className="mt-2 text-[13px] text-critical-ink">{uploadError}</p>
            )}
          </div>
        )}

        {backgroundType === "satellite" && (
          <div className="mt-4 space-y-2.5">
            <Input
              label="Farm Address"
              placeholder="e.g. Kluang, Johor"
              value={satQuery}
              onChange={(e) => setSatQuery(e.target.value)}
            />
            <Button
              variant="fill"
              size="sm"
              onClick={searchSatellite}
              disabled={satLoading || satQuery.trim().length === 0}
            >
              {satLoading ? "Searching…" : "🛰️ Find satellite image"}
            </Button>
            {satError ? (
              <p className="text-[13px] text-critical-ink">{satError}</p>
            ) : backgroundUrl ? (
              <p className="text-[13px] text-brand-dark">
                Satellite image found — see the preview below.
              </p>
            ) : (
              <p className="text-[13px] text-secondary">
                Search your town or address to pull a live satellite image. If
                it can&apos;t be found, the smart background is used.
              </p>
            )}
          </div>
        )}

        {/* 16:9 preview */}
        <p className="mb-1.5 mt-6 text-[12px] font-semibold uppercase tracking-wide text-secondary">
          Preview
        </p>
        <div className="aspect-video w-full overflow-hidden rounded-card shadow-card">
          {(backgroundType === "upload" || backgroundType === "satellite") &&
          backgroundUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={backgroundUrl}
              alt="Farm background preview"
              className="h-full w-full object-cover"
            />
          ) : (
            <SmartPreview label={name || "Your farm"} />
          )}
        </div>
      </div>

      <div className="fixed bottom-0 left-1/2 w-full max-w-[430px] -translate-x-1/2 px-6 py-4 glass-strong">
        <Button
          full
          disabled={!canContinue || uploading}
          onClick={() => router.push("/farms/new/zones")}
        >
          Next: Add Zones
        </Button>
      </div>
    </main>
  );
}
