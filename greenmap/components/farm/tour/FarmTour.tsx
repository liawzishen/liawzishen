"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import type { Farm, FarmPanorama, PanoramaPlantTag, Plant } from "@/types/database";
import { PanoramaSphere } from "./PanoramaSphere";
import { LookControls } from "./LookControls";
import { TourEmptyState } from "./TourEmptyState";
import { HopCircles } from "./HopCircles";
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
}: {
  farm: Farm;
  plants: Plant[];
  panoramas: FarmPanorama[];
  tags: PanoramaPlantTag[];
  loading: boolean;
  loadError: boolean;
  onMarkerClick: (plant: Plant) => void;
  onBackgroundClick?: () => void;
}) {
  const { t } = useI18n();
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState(false);
  const [fading, setFading] = useState(false);
  const fadeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  void plants; void tags; void onMarkerClick; // consumed by Task 4 (plant pins)

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
        />
        <HopCircles
          farm={farm}
          current={current}
          panoramas={panoramas}
          onHop={hopTo}
        />
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
    </div>
  );
}
