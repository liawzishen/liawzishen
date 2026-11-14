import type { Farm, FarmPanorama } from "@/types/database";

/** Radius of the photo sphere (camera sits at the origin inside it). */
export const SPHERE_R = 40;

/** Vertical field of view of the tour camera, in degrees. */
export const TOUR_FOV = 75;

/** Smallest comfortable touch target, in CSS pixels (WCAG / platform guidance). */
export const MIN_TAP_PX = 44;

/**
 * Yaw/pitch → position. Convention: yaw θ faces (-sin θ, 0, -cos θ), which is
 * exactly the direction of camera.rotation.set(pitch, yaw, 0, "YXZ").
 * pitch > 0 looks up. Positions sit just inside the sphere (r < SPHERE_R).
 */
export function toVec(
  yaw: number,
  pitch: number,
  r: number = SPHERE_R - 2
): [number, number, number] {
  return [
    -r * Math.cos(pitch) * Math.sin(yaw),
    r * Math.sin(pitch),
    -r * Math.cos(pitch) * Math.cos(yaw),
  ];
}

/** Inverse of toVec (for raycast hit points, in the SAME space as toVec). */
export function vecToSpherical(v: { x: number; y: number; z: number }): {
  yaw: number;
  pitch: number;
} {
  const r = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z) || 1;
  return { yaw: Math.atan2(-v.x, -v.z), pitch: Math.asin(v.y / r) };
}

/**
 * Bearing from one panorama's standing spot to another on the 2D map,
 * in radians CLOCKWISE from map-north (map "up" = −z in tour space).
 * Fractions are scaled by the farm canvas so bearings respect its aspect.
 */
export function mapBearing(
  farm: Farm,
  from: FarmPanorama,
  to: FarmPanorama
): number {
  const dx = (to.position_x - from.position_x) * farm.canvas_width;
  const dy = (to.position_y - from.position_y) * farm.canvas_height;
  return Math.atan2(dx, -dy);
}

/** Map bearing → tour-space yaw (see toVec convention). */
export function bearingToYaw(bearing: number): number {
  return -bearing;
}

/**
 * World units covered by one CSS pixel, for something `distance` units in
 * front of the camera. Used to give markers a minimum on-screen tap size:
 * a fixed world size shrinks to ~20 px on a phone-sized canvas.
 */
export function unitsPerPixel(
  viewportHeightPx: number,
  distance: number = SPHERE_R - 2,
  fovDeg: number = TOUR_FOV
): number {
  const visibleHeight = 2 * distance * Math.tan((fovDeg * Math.PI) / 360);
  return visibleHeight / Math.max(1, viewportHeightPx);
}

/**
 * Scale (width, height) down so the width is at most `maxWidth`, keeping the
 * aspect ratio. Never scales up. Sizes are whole pixels, at least 1.
 */
export function fitWithin(
  width: number,
  height: number,
  maxWidth: number
): { width: number; height: number; resized: boolean } {
  if (width <= maxWidth) return { width, height, resized: false };
  return {
    width: maxWidth,
    height: Math.max(1, Math.round((height * maxWidth) / width)),
    resized: true,
  };
}

/**
 * The other capture spots, nearest first (map distance, aspect-corrected).
 * The nearest spots are the likeliest next hop, so they are prefetched first.
 */
export function nearestPanoramas(
  farm: Pick<Farm, "canvas_width" | "canvas_height">,
  from: FarmPanorama,
  panoramas: FarmPanorama[]
): FarmPanorama[] {
  const distance = (p: FarmPanorama) =>
    Math.hypot(
      (p.position_x - from.position_x) * farm.canvas_width,
      (p.position_y - from.position_y) * farm.canvas_height
    );
  return panoramas
    .filter((p) => p.id !== from.id)
    .sort((a, b) => distance(a) - distance(b));
}
