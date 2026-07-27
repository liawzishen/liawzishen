"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
const HIT_R = BASE_R * 1.7; // invisible tap disc radius at full size
const TWO_PI = Math.PI * 2;
// Below this the two spots are within ~9° of each other and any target big
// enough to see would overlap anyway; keeping the ring legible wins over the
// last sliver of separation.
const MIN_SCALE = 0.25;

/** Live `(prefers-reduced-motion: reduce)`, so JS-driven motion can opt out. */
function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return reduced;
}

/** Smallest absolute angle between two bearings, folded into [0, π]. */
function angularGap(a: number, b: number): number {
  const d = Math.abs(a - b) % TWO_PI;
  return d > Math.PI ? TWO_PI - d : d;
}

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
  const reduced = usePrefersReducedMotion();

  const targets = useMemo(() => {
    const others = panoramas.filter((p) => p.id !== current.id);
    const bearings = others.map((p) => mapBearing(farm, current, p));

    return others.map((p, i) => {
      // Every target sits GROUND units out, so their hit discs are coplanar
      // circles on a ring of radius GROUND. Two of them stay disjoint iff the
      // sum of their radii is at most the chord between their centres; capping
      // EVERY radius at half the chord to its own nearest neighbour therefore
      // guarantees no pair overlaps. Without this the fixed 2.89-unit discs
      // overlap for any pair inside ~70° of each other (all three spots in the
      // seeded demo), and since the handler stops propagation the first ring in
      // the list silently swallows taps meant for the one beside it.
      let gap = Math.PI; // a lone target has nothing to collide with
      for (let j = 0; j < bearings.length; j++) {
        if (j === i) continue;
        gap = Math.min(gap, angularGap(bearings[i], bearings[j]));
      }
      const halfChord = GROUND * Math.sin(gap / 2);
      // One scale drives the tap disc AND the visible ring, so what you see is
      // exactly what you can tap.
      const scale = Math.max(MIN_SCALE, Math.min(1, halfChord / HIT_R));

      const yaw = bearingToYaw(bearings[i]);
      const dirX = -Math.sin(yaw);
      const dirZ = -Math.cos(yaw);
      return {
        pano: p,
        scale,
        pos: [dirX * GROUND, -DROP, dirZ * GROUND] as [number, number, number],
      };
    });
  }, [farm, current, panoramas]);

  return (
    <group>
      {targets.map(({ pano, pos, scale }) => (
        <HopRing
          key={pano.id}
          position={pos}
          scale={scale}
          still={reduced}
          onHop={() => onHop(pano)}
        />
      ))}
    </group>
  );
}

/** A single flat floor ring with a gentle "tap me" pulse + generous hit area. */
function HopRing({
  position,
  scale,
  still,
  onHop,
}: {
  position: [number, number, number];
  /** Shrinks ring + hit area together to keep neighbouring targets disjoint. */
  scale: number;
  /** Hold the pulse still for `prefers-reduced-motion: reduce`. */
  still: boolean;
  onHop: () => void;
}) {
  const pulse = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (!pulse.current) return;
    if (still) {
      // A CSS media query can't reach a useFrame loop — park it at rest here.
      pulse.current.scale.setScalar(1);
      return;
    }
    pulse.current.scale.setScalar(1 + Math.sin(clock.elapsedTime * 2.6) * 0.09);
  });

  return (
    <group position={position} scale={scale}>
      {/* Generous invisible flat disc = easy tap target (doesn't pulse). */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        onClick={(e: ThreeEvent<MouseEvent>) => {
          e.stopPropagation();
          onHop();
        }}
      >
        <circleGeometry args={[HIT_R, 32]} />
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
