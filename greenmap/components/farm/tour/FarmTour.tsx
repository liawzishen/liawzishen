"use client";

import { useCallback, useEffect, useState } from "react";
import { Canvas } from "@react-three/fiber";
import type { ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import type { Farm, FarmPanorama, PanoramaPlantTag, Plant } from "@/types/database";
import { PanoramaStage } from "./PanoramaStage";
import { LookControls } from "./LookControls";
import { TourEmptyState } from "./TourEmptyState";
import { HopCircles } from "./HopCircles";
import { PlantTagPins } from "./PlantTagPins";
import { TagEditor } from "./TagEditor";
import { TOUR_FOV, nearestPanoramas, vecToSpherical } from "./geometry";
import { fetchPanoBlob } from "./panoTexture";
import { shouldSaveData } from "@/lib/network";
import { useI18n } from "@/lib/i18n/LanguageProvider";

/** How many neighbouring photos are fetched ahead for instant hops. */
const PREFETCH_COUNT = 3;

/**
 * Matterport-style photo-sphere tour (2026-07-12 spec): stand inside a real
 * 360° farm photo, drag to look, tap a white circle to move to the next spot.
 * Client-only via next/dynamic.
 *
 * Two ids drive the view. `request` is the photo the farmer asked for;
 * `shownId` is the photo actually on screen. They differ while the next photo
 * is loading (the current one stays visible, then crossfades) and after a
 * failed load (the farmer stays where they were). Everything tied to a photo
 * — hop circles, plant pins, the direction slider — follows `shownId`.
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
  // no empty-state flash while an effect catches up). `attempt` lets a tap
  // on the same circle retry a photo that failed to load.
  const [request, setRequest] = useState<{ id: string | null; attempt: number }>(
    { id: startId, attempt: 0 }
  );
  const [shownId, setShownId] = useState<string | null>(null);
  const [failedId, setFailedId] = useState<string | null>(null);
  const [tagMode, setTagMode] = useState<"off" | "aim" | "pick">("off");
  const [pendingSpot, setPendingSpot] = useState<{
    yaw: number;
    pitch: number;
  } | null>(null);

  const goTo = useCallback((id: string) => {
    setFailedId(null);
    setRequest((r) => ({ id, attempt: r.attempt + 1 }));
  }, []);

  // Follow later startId changes (e.g. jump to a just-uploaded panorama).
  // The first run finds the id already requested and changes nothing.
  useEffect(() => {
    if (!startId) return;
    setRequest((r) =>
      r.id === startId ? r : { id: startId, attempt: r.attempt + 1 }
    );
    setFailedId(null);
  }, [startId]);

  const target =
    panoramas.find((p) => p.id === request.id) ?? panoramas[0] ?? null;
  const shown = panoramas.find((p) => p.id === shownId) ?? null;
  const photoError = target !== null && failedId === target.id;
  const photoLoading =
    target !== null && !photoError && shown?.id !== target.id;

  // Fetch the nearest other spots ahead of time so hops feel instant — but
  // only once the photo on screen has arrived (so they never compete with it
  // for bandwidth) and never when the visitor is saving data. Keyed on the
  // URL list, not the panoramas array, so heading-slider edits (which replace
  // the array on every input event) don't re-run it.
  const prefetchKey = shown
    ? nearestPanoramas(farm, shown, panoramas)
        .slice(0, PREFETCH_COUNT)
        .map((p) => p.image_url)
        .join("\n")
    : "";
  useEffect(() => {
    if (!prefetchKey || shouldSaveData()) return;
    for (const url of prefetchKey.split("\n")) {
      fetchPanoBlob(url).catch(() => {
        /* a failed prefetch is retried, and reported, by the hop itself */
      });
    }
  }, [prefetchKey]);

  if (loading) {
    return (
      <div className="flex h-full w-full items-center justify-center text-[15px] text-secondary">
        {t.tour.loading}
      </div>
    );
  }

  if (!target) {
    return <TourEmptyState notSetUp={loadError} onAddPhoto={onAddPhoto} />;
  }

  return (
    <div className="relative h-full w-full bg-[#1c241c]">
      <Canvas
        // Draw only when something changes (a drag, a fade, new data). A
        // still photo costs no GPU work and no battery.
        frameloop="demand"
        // Show the photo and the marker colours as they are; the default
        // film tone mapping is meant for lit 3D scenes and shifts both.
        flat
        dpr={[1, 1.75]}
        camera={{ fov: TOUR_FOV, position: [0, 0, 0], near: 0.1, far: 120 }}
        // Without this, a vertical drag on touch pans the page and the
        // browser fires pointercancel, killing LookControls' pitch drag.
        style={{ touchAction: "none" }}
        onPointerMissed={() => onBackgroundClick?.()}
      >
        <PanoramaStage
          target={target}
          attempt={request.attempt}
          panoramas={panoramas}
          onShown={setShownId}
          onFailed={setFailedId}
        />
        {shown && (
          // Pins and the tag-aim surface share the photo's heading rotation,
          // so they stick to the photo when the direction slider turns it.
          <group rotation-y={THREE.MathUtils.degToRad(shown.heading_deg)}>
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
              tags={tags.filter((tg) => tg.panorama_id === shown.id)}
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
          </group>
        )}
        {shown && tagMode === "off" && (
          <HopCircles
            farm={farm}
            current={shown}
            panoramas={panoramas}
            onHop={(pano) => goTo(pano.id)}
          />
        )}
        <LookControls />
      </Canvas>
      <div
        role="status"
        className="pointer-events-none absolute left-1/2 top-3 z-30 flex -translate-x-1/2 items-center gap-2 rounded-full bg-label/80 px-4 py-1.5 text-[12px] font-medium text-white"
      >
        {photoLoading && (
          <span
            aria-hidden
            className="h-3 w-3 shrink-0 animate-spin rounded-full border-2 border-white/40 border-t-white"
          />
        )}
        {photoError
          ? t.tour.loadFailed
          : photoLoading
            ? t.tour.loading
            : t.tour.hint}
        {photoError && (
          <button
            type="button"
            onClick={() => goTo(target.id)}
            className="pressable pointer-events-auto shrink-0 rounded-full bg-white/95 px-2.5 py-0.5 text-[12px] font-bold text-brand-dark"
          >
            {t.tour.retry}
          </button>
        )}
      </div>
      {shown && (
        <>
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
              value={shown.heading_deg}
              onChange={(e) =>
                void onUpdateHeading(shown.id, Number(e.target.value))
              }
              className="w-[140px]"
            />
          </div>
        </>
      )}
      <button
        type="button"
        onClick={onAddPhoto}
        aria-label={t.tour.addPhoto}
        className="pressable absolute left-3 top-3 z-30 rounded-full bg-white/95 px-3.5 py-1.5 text-[13px] font-bold text-brand-dark shadow-card"
      >
        ＋ 360°
      </button>
      {tagMode === "pick" && pendingSpot && shown && (
        <TagEditor
          plants={plants}
          onPick={(plant) => {
            void onAddTag({
              panorama_id: shown.id,
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
