"use client";

import { useMemo } from "react";
import type { ThreeEvent } from "@react-three/fiber";
import { healthDisplay } from "@/lib/health/display";
import type { PanoramaPlantTag, Plant } from "@/types/database";
import { markerTexture } from "./markerTexture";
import { toVec } from "./geometry";

const PIN_SIZE = 2.6;

/** Tags whose plant still exists, paired with it. Shared by pins and list. */
function resolveTags(tags: PanoramaPlantTag[], plants: Plant[]) {
  return tags
    .map((tag) => {
      const plant = plants.find((p) => p.id === tag.plant_id);
      return plant ? { tag, plant } : null;
    })
    .filter((x): x is { tag: PanoramaPlantTag; plant: Plant } => x !== null);
}

/**
 * Matterport-style tags: one billboard sprite per tagged plant, positioned by
 * (yaw, pitch) in PHOTO space — render inside PanoramaSphere's group so pins
 * rotate with the photo when heading changes.
 *
 * Sprites are three.js objects with no DOM node, so they can't be focused or
 * activated by keyboard — `PlantTagList` is the parallel DOM affordance that
 * calls the same `onPinClick`. Keep the two in step.
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
      resolveTags(tags, plants).map(({ tag, plant }) => {
        const band = healthDisplay(plant.health_score).band;
        const label =
          plant.health_score === null ? "New" : `${plant.health_score}%`;
        return {
          tag,
          plant,
          pos: toVec(tag.yaw, tag.pitch),
          tex: markerTexture(band, label),
        };
      }),
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

/**
 * Keyboard/AT route to the pins: a real <button> per tagged plant. The health
 * band is spelled out in text (never colour alone), and in tag-editing mode
 * the accessible name says the button REMOVES the tag, matching what the
 * shared handler actually does.
 */
export function PlantTagList({
  tags,
  plants,
  editing,
  onPinClick,
  className,
}: {
  tags: PanoramaPlantTag[];
  plants: Plant[];
  editing: boolean;
  onPinClick: (tag: PanoramaPlantTag, plant: Plant) => void;
  className?: string;
}) {
  const items = useMemo(() => resolveTags(tags, plants), [tags, plants]);
  if (items.length === 0) return null;

  return (
    <ul aria-label="Plants tagged in this photo" className={className}>
      {items.map(({ tag, plant }) => {
        const d = healthDisplay(plant.health_score);
        return (
          <li key={tag.id}>
            <button
              type="button"
              onClick={() => onPinClick(tag, plant)}
              aria-label={
                editing ? `Remove tag: ${plant.name}` : `${plant.name}, ${d.label}`
              }
              className="pressable flex w-full items-center gap-2 rounded-btn bg-white/95 px-3 py-2 text-left text-[13px] font-semibold text-brand-dark"
            >
              <span className="flex-1">{plant.name}</span>
              <span className={`text-[12px] font-medium ${d.textClass}`}>
                {d.label}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
