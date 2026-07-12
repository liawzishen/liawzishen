"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import type { Farm, FarmPanorama } from "@/types/database";
import { mapBearing, bearingToYaw } from "./geometry";

// Floor rings sit CLOSE to the camera so they read as big "step here" targets
// (Matterport style), not distant specks. Placed on the ground plane a few
// units ahead, in the real map-bearing direction of each other panorama.
const GROUND = 5; // horizontal distance ahead (world units)
const DROP = 2.3; // how far below eye level the floor sits
const BASE_R = 1.7; // ring radius on the ground

/**
 * Matterport-style navigation: one pulsing white floor ring per other
 * panorama, in that spot's real map-bearing direction. Tap one to hop there.
 * Rendered OUTSIDE the heading-rotated sphere group — bearings are world-space.
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
  const targets = useMemo(() => {
    return panoramas
      .filter((p) => p.id !== current.id)
      .map((p) => {
        const yaw = bearingToYaw(mapBearing(farm, current, p));
        const dirX = -Math.sin(yaw);
        const dirZ = -Math.cos(yaw);
        return {
          pano: p,
          pos: [dirX * GROUND, -DROP, dirZ * GROUND] as [
            number,
            number,
            number,
          ],
        };
      });
  }, [farm, current, panoramas]);

  return (
    <group>
      {targets.map(({ pano, pos }) => (
        <HopRing key={pano.id} position={pos} onHop={() => onHop(pano)} />
      ))}
    </group>
  );
}

/** A single flat floor ring with a gentle "tap me" pulse + generous hit area. */
function HopRing({
  position,
  onHop,
}: {
  position: [number, number, number];
  onHop: () => void;
}) {
  const pulse = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (!pulse.current) return;
    const s = 1 + Math.sin(clock.elapsedTime * 2.6) * 0.09;
    pulse.current.scale.set(s, s, s);
  });

  return (
    <group position={position}>
      {/* Generous invisible flat disc = easy tap target (doesn't pulse). */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        onClick={(e: ThreeEvent<MouseEvent>) => {
          e.stopPropagation();
          onHop();
        }}
      >
        <circleGeometry args={[BASE_R * 1.7, 32]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      {/* Visible pulsing ring + soft fill, laid flat on the ground. */}
      <group ref={pulse} rotation={[-Math.PI / 2, 0, 0]}>
        <mesh>
          <ringGeometry args={[BASE_R * 0.7, BASE_R, 48]} />
          <meshBasicMaterial
            color="#ffffff"
            transparent
            opacity={0.95}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
        <mesh position={[0, 0, 0.01]}>
          <circleGeometry args={[BASE_R * 0.7, 32]} />
          <meshBasicMaterial
            color="#bfe3ff"
            transparent
            opacity={0.35}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      </group>
    </group>
  );
}
