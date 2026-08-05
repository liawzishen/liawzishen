"use client";

import { useMemo } from "react";
import type { ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import type { Farm, FarmPanorama } from "@/types/database";
import { mapBearing, bearingToYaw, toVec } from "./geometry";

const CIRCLE_PITCH = -0.38; // radians below the horizon — reads as "on the ground"

const COMPASS = [
  "north",
  "north-east",
  "east",
  "south-east",
  "south",
  "south-west",
  "west",
  "north-west",
];

/** Nearest 8-point compass name for a map bearing (radians, cw from north). */
function compassName(bearing: number): string {
  const deg = (((bearing * 180) / Math.PI) % 360 + 360) % 360;
  return COMPASS[Math.round(deg / 45) % 8];
}

/**
 * Human name for a standing spot — its label, else its place in the tour.
 * Shared by the hop list and the tour's "you are here" announcement so a
 * spot is called the same thing everywhere.
 */
export function panoramaName(
  panoramas: FarmPanorama[],
  pano: FarmPanorama
): string {
  if (pano.label) return pano.label;
  const i = panoramas.findIndex((p) => p.id === pano.id);
  return `Spot ${i < 0 ? 1 : i + 1}`;
}

/** Every other panorama, with where it sits relative to the current one. */
function useHopTargets(
  farm: Farm,
  current: FarmPanorama,
  panoramas: FarmPanorama[]
) {
  return useMemo(() => {
    const w = farm.canvas_width;
    const h = farm.canvas_height;
    return panoramas
      .filter((p) => p.id !== current.id)
      .map((p) => {
        const dx = (p.position_x - current.position_x) * w;
        const dy = (p.position_y - current.position_y) * h;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const bearing = mapBearing(farm, current, p);
        // Nearer → bigger ring (clamped so far spots stay tappable).
        const scale = Math.max(1.4, Math.min(3.2, 900 / Math.max(dist, 1)));
        return {
          pano: p,
          pos: toVec(bearingToYaw(bearing), CIRCLE_PITCH),
          scale,
          bearing,
        };
      });
  }, [farm, current, panoramas]);
}

/**
 * Matterport-style navigation: one semi-transparent white ring per other
 * panorama, placed at its real map bearing. Nearer spots render larger.
 * Rings live OUTSIDE the heading-rotated group — bearings are world-space.
 *
 * These are three.js meshes, so they have no DOM node and cannot be focused
 * or activated by keyboard — `HopTargetList` is the parallel DOM affordance
 * that drives the same `onHop`. Keep the two in step.
 */
export function HopCircles({
  farm,
  current,
  panoramas,
  onHop,
}: {
  farm: Farm;
  current: FarmPanorama;
  panoramas: FarmPanorama[];
  onHop: (target: FarmPanorama) => void;
}) {
  const rings = useHopTargets(farm, current, panoramas);

  return (
    <group>
      {rings.map(({ pano, pos, scale }) => (
        <group
          key={pano.id}
          position={pos}
          onUpdate={(self) => self.lookAt(0, 0, 0)}
        >
          <mesh
            onClick={(e: ThreeEvent<MouseEvent>) => {
              e.stopPropagation();
              onHop(pano);
            }}
          >
            {/* invisible fat disc = ≥44px tap target */}
            <circleGeometry args={[scale * 0.9, 24]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          </mesh>
          <mesh>
            <ringGeometry args={[scale * 0.55, scale * 0.75, 32]} />
            <meshBasicMaterial
              color="#ffffff"
              transparent
              opacity={0.85}
              side={THREE.DoubleSide}
              depthWrite={false}
            />
          </mesh>
          <mesh>
            <circleGeometry args={[scale * 0.5, 24]} />
            <meshBasicMaterial
              color="#ffffff"
              transparent
              opacity={0.25}
              depthWrite={false}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/**
 * Keyboard/AT route to the hop circles: a real <button> per destination,
 * named by label (or "Spot n") plus the compass direction the ring sits in,
 * so the list and the rings describe the same world. Rendered in the DOM
 * OUTSIDE the <Canvas>.
 */
export function HopTargetList({
  farm,
  current,
  panoramas,
  onHop,
  className,
}: {
  farm: Farm;
  current: FarmPanorama;
  panoramas: FarmPanorama[];
  onHop: (target: FarmPanorama) => void;
  className?: string;
}) {
  const targets = useHopTargets(farm, current, panoramas);
  if (targets.length === 0) return null;

  return (
    <ul aria-label="Move to another standing spot" className={className}>
      {targets.map(({ pano, bearing }) => (
        <li key={pano.id}>
          <button
            type="button"
            onClick={() => onHop(pano)}
            className="pressable w-full rounded-btn bg-white/95 px-3 py-2 text-left text-[13px] font-semibold text-brand-dark"
          >
            {`Move to ${panoramaName(panoramas, pano)} — ${compassName(
              bearing
            )}`}
          </button>
        </li>
      ))}
    </ul>
  );
}
