"use client";

import { useMemo } from "react";
import type { ThreeEvent } from "@react-three/fiber";
import { healthDisplay } from "@/lib/health/display";
import type { PanoramaPlantTag, Plant } from "@/types/database";
import { markerTexture } from "./markerTexture";
import { toVec } from "./geometry";

const PIN_SIZE = 2.6;

/**
 * Matterport-style tags: one billboard sprite per tagged plant, positioned by
 * (yaw, pitch) in PHOTO space — render inside PanoramaSphere's group so pins
 * rotate with the photo when heading changes.
 */
export function PlantTagPins({
  tags,
  plants,
  editing,
  onPinClick,
}: {
  tags: PanoramaPlantTag[];
  plants: Plant[];
  editing: boolean;
  onPinClick: (tag: PanoramaPlantTag, plant: Plant) => void;
}) {
  const items = useMemo(
    () =>
      tags
        .map((tag) => {
          const plant = plants.find((p) => p.id === tag.plant_id);
          if (!plant) return null;
          const band = healthDisplay(plant.health_score).band;
          const label =
            plant.health_score === null ? "New" : `${plant.health_score}%`;
          return {
            tag,
            plant,
            pos: toVec(tag.yaw, tag.pitch),
            tex: markerTexture(band, label),
          };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null),
    [tags, plants]
  );

  return (
    <group>
      {items.map(({ tag, plant, pos, tex }) => (
        <sprite
          key={tag.id}
          position={pos}
          scale={[
            PIN_SIZE * (editing ? 1.2 : 1),
            PIN_SIZE * (editing ? 1.2 : 1),
            1,
          ]}
          onClick={(e: ThreeEvent<MouseEvent>) => {
            e.stopPropagation();
            onPinClick(tag, plant);
          }}
        >
          <spriteMaterial map={tex} depthWrite={false} />
        </sprite>
      ))}
    </group>
  );
}
