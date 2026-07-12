import type { Farm, FarmPanorama } from "@/types/database";

/** Radius of the photo sphere (camera sits at the origin inside it). */
export const SPHERE_R = 40;

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
