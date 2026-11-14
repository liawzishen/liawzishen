"use client";

import { useMemo } from "react";
import { useThree } from "@react-three/fiber";
import type { ThreeEvent } from "@react-three/fiber";
import { healthDisplay } from "@/lib/health/display";
import type { PanoramaPlantTag, Plant } from "@/types/database";
import { markerTexture } from "./markerTexture";
import { MIN_TAP_PX, toVec, unitsPerPixel } from "./geometry";

const PIN_SIZE = 2.6;

/** A press that moved further than this (px) was a look-around drag, not a tap. */
const TAP_SLOP_PX = 6;

/**
 * Matterport-style tags: one billboard sprite per tagged plant, positioned by
 * (yaw, pitch) in PHOTO space — render inside PanoramaSphere's group so pins
 * rotate with the photo when heading changes.
 *
 * A pin is about 20 px wide on a phone, so an invisible sprite of at least
 * 44 px sits on top of it to catch taps.
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
  const viewportHeight = useThree((s) => s.size.height);
  const size = PIN_SIZE * (editing ? 1.2 : 1);
  const tapSize = Math.max(size, MIN_TAP_PX * unitsPerPixel(viewportHeight));

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
        <group key={tag.id} position={pos}>
          <sprite scale={[size, size, 1]}>
            <spriteMaterial map={tex} depthWrite={false} />
          </sprite>
          <sprite
            scale={[tapSize, tapSize, 1]}
            onClick={(e: ThreeEvent<MouseEvent>) => {
              e.stopPropagation();
              if (e.delta > TAP_SLOP_PX) return; // end of a drag, not a tap
              onPinClick(tag, plant);
            }}
          >
            <spriteMaterial transparent opacity={0} depthWrite={false} />
          </sprite>
        </group>
      ))}
    </group>
  );
}
