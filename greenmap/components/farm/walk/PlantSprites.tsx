"use client";

import { useMemo } from "react";
import type { ThreeEvent } from "@react-three/fiber";
import { healthDisplay } from "@/lib/health/display";
import type { Farm, Plant } from "@/types/database";
import { markerTexture } from "./markerTexture";
import { toWorld } from "./world";

const SPRITE_SIZE = 1.5; // world units — reads clearly from ~3–20 m away
const SPRITE_Y = 1.25; // floats at chest height like a field tag

/** One billboard sprite per active plant + a soft ground shadow disc. */
export function PlantSprites({
  farm,
  plants,
  onMarkerClick,
}: {
  farm: Farm;
  plants: Plant[];
  onMarkerClick: (plant: Plant) => void;
}) {
  const items = useMemo(
    () =>
      plants.map((p) => {
        const band = healthDisplay(p.health_score).band;
        const label = p.health_score === null ? "New" : `${p.health_score}%`;
        return {
          plant: p,
          pos: toWorld(farm, p.position_x, p.position_y),
          tex: markerTexture(band, label),
        };
      }),
    [farm, plants]
  );

  return (
    <group>
      {items.map(({ plant, pos, tex }) => (
        <group key={plant.id} position={pos}>
          <sprite
            position={[0, SPRITE_Y, 0]}
            scale={[SPRITE_SIZE, SPRITE_SIZE, 1]}
            onClick={(e: ThreeEvent<MouseEvent>) => {
              e.stopPropagation(); // don't also fire onPointerMissed
              onMarkerClick(plant);
            }}
          >
            <spriteMaterial map={tex} depthWrite={false} />
          </sprite>
          {/* soft shadow disc anchoring the sprite to the ground */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
            <circleGeometry args={[0.45, 20]} />
            <meshBasicMaterial color="#1e2f1e" transparent opacity={0.25} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
