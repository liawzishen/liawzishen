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
}) {
  const { t } = useI18n();
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState(false);
  const [fading, setFading] = useState(false);
  const fadeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [tagMode, setTagMode] = useState<"off" | "aim" | "pick">("off");
  const [pendingSpot, setPendingSpot] = useState<{
    yaw: number;
    pitch: number;
  } | null>(null);

  // Enter the first panorama once loaded (Task 6 adds startId for 2D badges).
  useEffect(() => {
    if (!currentId && panoramas.length > 0) setCurrentId(panoramas[0].id);
  }, [panoramas, currentId]);

  const current = panoramas.find((p) => p.id === currentId) ?? null;

  // Preload the target photo, then fade → swap → unfade. ~250 ms total.
  const hopTo = useCallback((target: FarmPanorama) => {
    const img = new Image();
    img.src = target.image_url;
    const go = () => {
      setFading(true);
      fadeTimer.current = setTimeout(() => {
        setPhotoError(false);
        setCurrentId(target.id);
        setFading(false);
      }, 125);
    };
    if (img.complete) go();
    else {
      img.onload = go;
      img.onerror = go; // still hop; PanoramaSphere will surface the error
    }
  }, []);

  useEffect(() => {
    return () => {
      if (fadeTimer.current) clearTimeout(fadeTimer.current);
    };
  }, []);

  // Prefetch neighbours' photos into the browser cache for instant hops.
  useEffect(() => {
    panoramas
      .filter((p) => p.id !== currentId)
      .slice(0, 4)
      .forEach((p) => {
        const img = new Image();
        img.src = p.image_url;
      });
  }, [currentId, panoramas]);

  if (loading) {
    return (
      <div className="flex h-full w-full items-center justify-center text-[15px] text-secondary">
        {t.tour.loading}
      </div>
    );
  }

  if (!current) {
    return <TourEmptyState notSetUp={loadError} />;
  }

  return (
    <div className="relative h-full w-full bg-[#1c241c]">
      <Canvas
        dpr={[1, 1.75]}
        camera={{ fov: 75, position: [0, 0, 0], near: 0.1, far: 120 }}
        onPointerMissed={() => onBackgroundClick?.()}
      >
        <PanoramaSphere
          key={current.id}
          pano={current}
          onLoadError={() => setPhotoError(true)}
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
          fading ? "opacity-70" : "opacity-0"
        }`}
      />
      <div className="pointer-events-none absolute left-1/2 top-3 z-10 -translate-x-1/2 rounded-full bg-label/80 px-4 py-1.5 text-[12px] font-medium text-white">
        {photoError ? t.tour.loadFailed : t.tour.hint}
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
