"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import type { ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import type { Farm, FarmPanorama, PanoramaPlantTag, Plant } from "@/types/database";
import { PanoramaSphere } from "./PanoramaSphere";
import { LookControls } from "./LookControls";
import { TourEmptyState } from "./TourEmptyState";
import { HopCircles, HopTargetList, panoramaName } from "./HopCircles";
import { PlantTagPins, PlantTagList } from "./PlantTagPins";
import { TagEditor } from "./TagEditor";
import { vecToSpherical } from "./geometry";
import { useI18n } from "@/lib/i18n/LanguageProvider";

const HINT_PILL =
  "pointer-events-none absolute left-1/2 top-3 z-10 -translate-x-1/2 rounded-full bg-label/80 px-4 py-1.5 text-[12px] font-medium text-white";

/**
 * Matterport-style photo-sphere tour (2026-07-12 spec): stand inside a real
 * 360° farm photo, drag to look. Hop circles (Task 3), plant tags (Task 4),
 * upload (Task 5) layer onto this composition. Client-only via next/dynamic.
 *
 * Everything inside <Canvas> is three.js — no DOM, so nothing in the scene can
 * be focused or activated by keyboard. The tour therefore ships TWO routes to
 * the same handlers: the meshes for pointers, and a DOM nav panel (hop list +
 * tag list) for keyboard/AT. The panel is sr-only until focus enters it, then
 * it shows itself so a sighted keyboard user can see where they are.
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
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState(false);
  const [fading, setFading] = useState(false);
  const fadeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [tagMode, setTagMode] = useState<"off" | "aim" | "pick">("off");
  const [pendingSpot, setPendingSpot] = useState<{
    yaw: number;
    pitch: number;
  } | null>(null);
  // The focusable viewport: keyboard look hangs off it, and it is where focus
  // goes back to whenever a nav button removes itself from the DOM.
  const viewportRef = useRef<HTMLDivElement>(null);
  const [navOpen, setNavOpen] = useState(false);
  const howToId = useId();

  const focusViewport = useCallback(() => {
    viewportRef.current?.focus();
  }, []);

  // Enter the requested panorama (2D badge tap) or the first one.
  useEffect(() => {
    if (currentId) return;
    if (startId && panoramas.some((p) => p.id === startId)) {
      setCurrentId(startId);
    } else if (panoramas.length > 0) {
      setCurrentId(panoramas[0].id);
    }
  }, [panoramas, currentId, startId]);

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

  // One handler for both routes to a pin (sprite raycast and DOM list).
  const handlePin = useCallback(
    (tag: PanoramaPlantTag, plant: Plant) => {
      if (tagMode !== "off") {
        if (window.confirm(t.tour.removeTag)) void onRemoveTag(tag.id);
      } else {
        onMarkerClick(plant);
      }
    },
    [tagMode, t, onRemoveTag, onMarkerClick]
  );

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
      <div
        role="status"
        className="flex h-full w-full items-center justify-center text-[15px] text-secondary"
      >
        {t.tour.loading}
      </div>
    );
  }

  if (!current) {
    return <TourEmptyState notSetUp={loadError} onAddPhoto={onAddPhoto} />;
  }

  const currentName = panoramaName(panoramas, current);

  return (
    <div className="relative h-full w-full bg-[#1c241c]">
      <div
        ref={viewportRef}
        tabIndex={0}
        role="application"
        aria-label={`360° photo tour of ${farm.name}`}
        aria-describedby={howToId}
        /* The card clips its overflow, so draw the focus ring inside. */
        className="h-full w-full focus-visible:[outline-offset:-4px]"
      >
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
              onPinClick={handlePin}
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
          <LookControls hostRef={viewportRef} />
        </Canvas>
      </div>
      {/* Hopping swaps the photo with no focus change — say where we landed. */}
      <p role="status" className="sr-only">
        {`Now at ${currentName}`}
      </p>
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-0 z-20 bg-black transition-opacity duration-150 ${
          fading ? "opacity-70" : "opacity-0"
        }`}
      />
      {photoError ? (
        <p role="alert" className={HINT_PILL}>
          {t.tour.loadFailed}
        </p>
      ) : (
        <p className={HINT_PILL}>{t.tour.hint}</p>
      )}
      <button
        type="button"
        aria-pressed={tagMode !== "off"}
        onClick={() => {
          setTagMode((m) => (m === "off" ? "aim" : "off"));
          setPendingSpot(null);
        }}
        className={`pressable absolute bottom-4 right-4 z-30 rounded-full px-4 py-2 text-[13px] font-bold shadow-card ${
          tagMode !== "off"
            ? "bg-warning-ink text-white"
            : "bg-white/95 text-brand-dark"
        }`}
      >
        {tagMode !== "off" ? t.tour.cancel : t.tour.tagPlant}
      </button>
      {tagMode === "aim" && (
        <p
          role="status"
          className="pointer-events-none absolute left-1/2 top-12 z-30 -translate-x-1/2 rounded-full bg-warning-ink px-4 py-1.5 text-[12px] font-semibold text-white"
        >
          {t.tour.tapSpot}
        </p>
      )}
      <button
        type="button"
        onClick={onAddPhoto}
        aria-label={t.tour.addPhoto}
        className="pressable absolute left-3 top-3 z-30 rounded-full bg-white/95 px-3.5 py-1.5 text-[13px] font-bold text-brand-dark shadow-card"
      >
        <span aria-hidden>＋ 360°</span>
      </button>
      {/*
        Keyboard/AT twin of the 3D scene. sr-only until focus lands inside,
        then it becomes a real panel — never display:none or aria-hidden, or
        the tour's whole navigation would be unreachable again.
      */}
      <nav
        aria-label="Tour navigation"
        onFocus={() => setNavOpen(true)}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget)) setNavOpen(false);
        }}
        className={
          navOpen
            ? "absolute inset-x-3 bottom-16 z-40 flex max-h-[55%] flex-col gap-2 overflow-y-auto rounded-card bg-card p-3 shadow-card"
            : "sr-only"
        }
      >
        <p id={howToId} className={navOpen ? "text-[12px] text-secondary" : ""}>
          {`You are at ${currentName}. Look around with the arrow keys or W A S D. The buttons here move you to another standing spot and open the plants tagged in this photo.`}
        </p>
        {tagMode === "off" && (
          <HopTargetList
            farm={farm}
            current={current}
            panoramas={panoramas}
            // The button for the spot you left is removed on arrival, so hand
            // focus back to the viewport instead of dropping it on <body>.
            onHop={(target) => {
              hopTo(target);
              focusViewport();
            }}
            className="flex flex-col gap-1.5"
          />
        )}
        <PlantTagList
          tags={tags.filter((tg) => tg.panorama_id === current.id)}
          plants={plants}
          editing={tagMode !== "off"}
          onPinClick={(tag, plant) => {
            handlePin(tag, plant);
            // Removing a tag deletes this very button — same focus rescue.
            if (tagMode !== "off") focusViewport();
          }}
          className="flex flex-col gap-1.5"
        />
      </nav>
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
          aria-valuetext={`${current.heading_deg}°`}
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
            focusViewport();
          }}
          onCancel={() => {
            setTagMode("off");
            setPendingSpot(null);
            focusViewport();
          }}
        />
      )}
    </div>
  );
}
