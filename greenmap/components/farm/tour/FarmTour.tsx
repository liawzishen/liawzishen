"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import type { ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import type { Farm, FarmPanorama, PanoramaPlantTag, Plant } from "@/types/database";
import { PanoramaSphere } from "./PanoramaSphere";
import { LookControls } from "./LookControls";
import { TourEmptyState } from "./TourEmptyState";
import { HopCircles } from "./HopCircles";
import { PlantTagPins } from "./PlantTagPins";
import { TagEditor } from "./TagEditor";
import { vecToSpherical } from "./geometry";
import { useI18n } from "@/lib/i18n/LanguageProvider";

/**
 * Matterport-style photo-sphere tour (2026-07-12 spec): stand inside a real
 * 360° farm photo, drag to look. Hop circles (Task 3), plant tags (Task 4),
 * upload (Task 5) layer onto this composition. Client-only via next/dynamic.
 */
export function FarmTour({
  farm,
  plants,
  panoramas,
  tags,
  loading,
  loadError,
  onMarkerClick,
  onBackgroundClick,
  onAddTag,
  onRemoveTag,
  onAddPhoto,
  onUpdateHeading,
  startId,
}: {
  farm: Farm;
  plants: Plant[];
  panoramas: FarmPanorama[];
  tags: PanoramaPlantTag[];
  loading: boolean;
  loadError: boolean;
  onMarkerClick: (plant: Plant) => void;
  onBackgroundClick?: () => void;
  onAddTag: (input: {
    panorama_id: string;
    plant_id: string;
    yaw: number;
    pitch: number;
  }) => Promise<unknown>;
  onRemoveTag: (id: string) => Promise<void>;
  onAddPhoto: () => void;
  onUpdateHeading: (id: string, heading_deg: number) => Promise<void>;
  startId: string | null;
}) {
  const { t } = useI18n();
  // Seeded from the 2D badge tap (startId); hops overwrite it. A null or
  // unknown id falls back to the first panorama (derived below, so there's
  // no empty-state flash while an effect catches up).
  const [currentId, setCurrentId] = useState<string | null>(startId);
  // The latest texture result, keyed by panorama id so a hop or jump never
  // inherits the previous photo's state (and a retry can clear a failure).
  const [photo, setPhoto] = useState<{ id: string; failed: boolean } | null>(
    null
  );
  // From a hop-circle tap until the swap; the dim then holds until the new
  // texture is ready, so a slow phone gets feedback at once, never a blank.
  const [hopping, setHopping] = useState(false);
  const fadeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hopSeq = useRef(0);
  const [tagMode, setTagMode] = useState<"off" | "aim" | "pick">("off");
  const [pendingSpot, setPendingSpot] = useState<{
    yaw: number;
    pitch: number;
  } | null>(null);

  // Abandon any hop in flight: its pending swap and its dim.
  const cancelHop = useCallback(() => {
    hopSeq.current++;
    if (fadeTimer.current) clearTimeout(fadeTimer.current);
    setHopping(false);
  }, []);

  // Follow later startId changes (e.g. jump to a just-uploaded panorama);
  // this supersedes any hop still waiting on its photo.
  useEffect(() => {
    if (!startId) return;
    cancelHop();
    setCurrentId(startId);
  }, [startId, cancelHop]);

  const current =
    panoramas.find((p) => p.id === currentId) ?? panoramas[0] ?? null;
  const photoSettled = current !== null && photo?.id === current.id;
  const photoError = photoSettled && photo.failed;
  const photoLoading = current !== null && !photoSettled;

  // Dim at once, preload the target photo, then swap once the dim has had
  // ~125 ms to land. The dim lifts when the new sphere's texture is ready.
  // A newer tap supersedes an older hop still waiting on its photo.
  const hopTo = useCallback((target: FarmPanorama) => {
    const seq = ++hopSeq.current;
    const tappedAt = Date.now();
    setHopping(true);
    const img = new Image();
    img.crossOrigin = "anonymous"; // same request mode as THREE.TextureLoader
    img.src = target.image_url;
    const go = () => {
      if (seq !== hopSeq.current) return;
      if (fadeTimer.current) clearTimeout(fadeTimer.current);
      fadeTimer.current = setTimeout(() => {
        if (seq !== hopSeq.current) return;
        setCurrentId(target.id);
        setHopping(false);
      }, Math.max(0, 125 - (Date.now() - tappedAt)));
    };
    if (img.complete) go();
    else {
      img.onload = go;
      img.onerror = go; // still hop; PanoramaSphere will surface the error
    }
  }, []);

  useEffect(() => cancelHop, [cancelHop]);

  // Prefetch other spots' photos into the browser cache for instant hops.
  // Keyed on the URL list, not the panoramas array, so heading-slider edits
  // (which replace the array on every input event) don't re-run it.
  const prefetchKey = panoramas
    .filter((p) => p.id !== current?.id)
    .slice(0, 4)
    .map((p) => p.image_url)
    .join("\n");
  useEffect(() => {
    if (!prefetchKey) return;
    for (const url of prefetchKey.split("\n")) {
      const img = new Image();
      img.crossOrigin = "anonymous"; // same request mode as THREE.TextureLoader
      img.src = url;
    }
  }, [prefetchKey]);

  if (loading) {
    return (
      <div className="flex h-full w-full items-center justify-center text-[15px] text-secondary">
        {t.tour.loading}
      </div>
    );
  }

  if (!current) {
    return <TourEmptyState notSetUp={loadError} onAddPhoto={onAddPhoto} />;
  }

  return (
    <div className="relative h-full w-full bg-[#1c241c]">
      <Canvas
        dpr={[1, 1.75]}
        camera={{ fov: 75, position: [0, 0, 0], near: 0.1, far: 120 }}
        // Without this, a vertical drag on touch pans the page and the
        // browser fires pointercancel, killing LookControls' pitch drag.
        style={{ touchAction: "none" }}
        onPointerMissed={() => onBackgroundClick?.()}
      >
        <PanoramaSphere
          key={current.id}
          pano={current}
          onLoaded={() => setPhoto({ id: current.id, failed: false })}
          onLoadError={() => setPhoto({ id: current.id, failed: true })}
        >
          {tagMode === "aim" && (
            <mesh
              scale={[-1, 1, 1]}
              onClick={(e: ThreeEvent<MouseEvent>) => {
                e.stopPropagation();
                // hit point is world-space; convert to photo space via the
                // rotated parent group so tags stick to the photo.
                const local = e.object.parent!.worldToLocal(e.point.clone());
                setPendingSpot(vecToSpherical(local));
                setTagMode("pick");
              }}
            >
              {/* r=39: just BEHIND the pins (r=38) so pin taps win the raycast */}
              <sphereGeometry args={[39, 32, 24]} />
              <meshBasicMaterial
                transparent
                opacity={0}
                side={THREE.DoubleSide}
                depthWrite={false}
              />
            </mesh>
          )}
          <PlantTagPins
            tags={tags.filter((tg) => tg.panorama_id === current.id)}
            plants={plants}
            editing={tagMode !== "off"}
            onPinClick={(tag: PanoramaPlantTag, plant) => {
              if (tagMode !== "off") {
                if (window.confirm(t.tour.removeTag)) void onRemoveTag(tag.id);
              } else {
                onMarkerClick(plant);
              }
            }}
          />
        </PanoramaSphere>
        {tagMode === "off" && (
          <HopCircles
            farm={farm}
            current={current}
            panoramas={panoramas}
            onHop={hopTo}
          />
        )}
        <LookControls />
      </Canvas>
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-0 z-20 bg-black transition-opacity duration-150 ${
          hopping || photoLoading ? "opacity-70" : "opacity-0"
        }`}
      />
      <div
        role="status"
        className="pointer-events-none absolute left-1/2 top-3 z-30 -translate-x-1/2 rounded-full bg-label/80 px-4 py-1.5 text-[12px] font-medium text-white"
      >
        {photoError
          ? t.tour.loadFailed
          : hopping || photoLoading
            ? t.tour.loading
            : t.tour.hint}
      </div>
      <button
        type="button"
        onClick={() => {
          setTagMode((m) => (m === "off" ? "aim" : "off"));
          setPendingSpot(null);
        }}
        className={`pressable absolute bottom-4 right-4 z-30 rounded-full px-4 py-2 text-[13px] font-bold shadow-card ${
          tagMode !== "off"
            ? "bg-warning text-white"
            : "bg-white/95 text-brand-dark"
        }`}
      >
        {tagMode !== "off" ? t.tour.cancel : t.tour.tagPlant}
      </button>
      {tagMode === "aim" && (
        <div className="pointer-events-none absolute left-1/2 top-12 z-30 -translate-x-1/2 rounded-full bg-warning/90 px-4 py-1.5 text-[12px] font-semibold text-white">
          {t.tour.tapSpot}
        </div>
      )}
      <button
        type="button"
        onClick={onAddPhoto}
        aria-label={t.tour.addPhoto}
        className="pressable absolute left-3 top-3 z-30 rounded-full bg-white/95 px-3.5 py-1.5 text-[13px] font-bold text-brand-dark shadow-card"
      >
        ＋ 360°
      </button>
      <div className="absolute bottom-4 left-4 z-30 flex flex-col gap-1 rounded-card bg-white/90 px-3 py-2 shadow-card">
        <label
          htmlFor="pano-heading"
          className="text-[11px] font-semibold uppercase tracking-wide text-secondary"
        >
          {t.tour.setDirection}
        </label>
        <input
          id="pano-heading"
          type="range"
          min={-180}
          max={180}
          step={1}
          value={current.heading_deg}
          onChange={(e) =>
            void onUpdateHeading(current.id, Number(e.target.value))
          }
          className="w-[140px]"
        />
      </div>
      {tagMode === "pick" && pendingSpot && (
        <TagEditor
          plants={plants}
          onPick={(plant) => {
            void onAddTag({
              panorama_id: current.id,
              plant_id: plant.id,
              yaw: pendingSpot.yaw,
              pitch: pendingSpot.pitch,
            });
            setTagMode("off");
            setPendingSpot(null);
          }}
          onCancel={() => {
            setTagMode("off");
            setPendingSpot(null);
          }}
        />
      )}
    </div>
  );
}
