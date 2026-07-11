import type { Farm } from "@/types/database";

/**
 * World mapping — single source of truth for 2D↔3D coordinates.
 * The farm canvas (canvas_width × canvas_height px) becomes a ground plane
 * whose longest side is WORLD_LONG units; plant fractions (0–1) map onto it,
 * centered on the origin. +x = canvas right, +z = canvas down.
 */
const WORLD_LONG = 60;

export function worldSize(farm: Farm): { w: number; d: number } {
  const cw = farm.canvas_width || 1000;
  const ch = farm.canvas_height || 700;
  const s = WORLD_LONG / Math.max(cw, ch);
  return { w: cw * s, d: ch * s };
}

export function toWorld(
  farm: Farm,
  x01: number,
  y01: number
): [number, number, number] {
  const { w, d } = worldSize(farm);
  return [(x01 - 0.5) * w, 0, (y01 - 0.5) * d];
}

/** Eye height of the walking camera, in world units (~1.6 m). */
export const EYE_HEIGHT = 1.6;
