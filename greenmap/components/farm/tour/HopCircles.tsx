"use client";

import { useMemo } from "react";
import type { ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import type { Farm, FarmPanorama } from "@/types/database";
import { mapBearing, bearingToYaw, toVec } from "./geometry";

const CIRCLE_PITCH = -0.38; // radians below the horizon — reads as "on the ground"

/**
 * Matterport-style navigation: one semi-transparent white ring per other
 * panorama, placed at its real map bearing. Nearer spots render larger.
 * Rings live OUTSIDE the heading-rotated group — bearings are world-space.
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
  const rings = useMemo(() => {
    const w = farm.canvas_width;
    const h = farm.canvas_height;
    return panoramas
      .filter((p) => p.id !== current.id)
      .map((p) => {
        const dx = (p.position_x - current.position_x) * w;
        const dy = (p.position_y - current.position_y) * h;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const yaw = bearingToYaw(mapBearing(farm, current, p));
        // Nearer → bigger ring (clamped so far spots stay tappable).
        const scale = Math.max(1.4, Math.min(3.2, 900 / Math.max(dist, 1)));
        return { pano: p, pos: toVec(yaw, CIRCLE_PITCH), scale };
      });
  }, [farm, current, panoramas]);

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
