import { describe, expect, it } from "vitest";
import type { FarmPanorama } from "@/types/database";
import {
  MIN_TAP_PX,
  SPHERE_R,
  TOUR_FOV,
  bearingToYaw,
  fitWithin,
  mapBearing,
  nearestPanoramas,
  toVec,
  unitsPerPixel,
  vecToSpherical,
} from "./geometry";

const farm = { canvas_width: 1600, canvas_height: 900 };

function pano(id: string, x: number, y: number): FarmPanorama {
  return {
    id,
    farm_id: "farm",
    image_url: `/${id}.jpg`,
    position_x: x,
    position_y: y,
    heading_deg: 0,
    label: null,
    created_at: "2026-07-12T00:00:00Z",
  };
}

describe("toVec / vecToSpherical", () => {
  it("puts yaw 0, pitch 0 straight ahead (−z), just inside the sphere", () => {
    const [x, y, z] = toVec(0, 0);
    expect(x).toBeCloseTo(0);
    expect(y).toBeCloseTo(0);
    expect(z).toBeCloseTo(-(SPHERE_R - 2));
  });

  it("turns left for positive yaw and up for positive pitch", () => {
    expect(toVec(Math.PI / 2, 0)[0]).toBeLessThan(0); // −x is to the left
    expect(toVec(0, 0.5)[1]).toBeGreaterThan(0);
  });

  it("round-trips through vecToSpherical", () => {
    for (const [yaw, pitch] of [
      [0.6, -0.12],
      [-2.4, 0.9],
      [3.0, -1.2],
      [0, 0],
    ]) {
      const [x, y, z] = toVec(yaw, pitch);
      const back = vecToSpherical({ x, y, z });
      expect(back.yaw).toBeCloseTo(yaw);
      expect(back.pitch).toBeCloseTo(pitch);
    }
  });

  it("does not divide by zero for a zero vector", () => {
    const back = vecToSpherical({ x: 0, y: 0, z: 0 });
    expect(Number.isFinite(back.yaw)).toBe(true);
    expect(back.pitch).toBe(0);
  });
});

describe("mapBearing / bearingToYaw", () => {
  const here = pano("here", 0.5, 0.5);

  it("measures clockwise from map-north", () => {
    expect(mapBearing(farm as never, here, pano("n", 0.5, 0.2))).toBeCloseTo(0);
    expect(mapBearing(farm as never, here, pano("e", 0.8, 0.5))).toBeCloseTo(Math.PI / 2);
    expect(Math.abs(mapBearing(farm as never, here, pano("s", 0.5, 0.8)))).toBeCloseTo(Math.PI);
    expect(mapBearing(farm as never, here, pano("w", 0.2, 0.5))).toBeCloseTo(-Math.PI / 2);
  });

  it("respects the canvas aspect ratio", () => {
    // Equal fractions are not 45° on a 16:9 canvas.
    const bearing = mapBearing(farm as never, here, pano("ne", 0.6, 0.4));
    expect(bearing).toBeCloseTo(Math.atan2(160, 90));
  });

  it("puts a spot to the east on the viewer's right", () => {
    const yaw = bearingToYaw(mapBearing(farm as never, here, pano("e", 0.8, 0.5)));
    expect(toVec(yaw, 0)[0]).toBeGreaterThan(0); // +x is to the right
  });
});

describe("unitsPerPixel", () => {
  it("matches the visible height of the view at that distance", () => {
    const distance = 38;
    const visible = 2 * distance * Math.tan((TOUR_FOV * Math.PI) / 360);
    expect(unitsPerPixel(480, distance) * 480).toBeCloseTo(visible);
  });

  it("gives a bigger world size on a smaller canvas for the same 44 px", () => {
    const phone = MIN_TAP_PX * unitsPerPixel(420);
    const desktop = MIN_TAP_PX * unitsPerPixel(900);
    expect(phone).toBeGreaterThan(desktop);
    expect(phone).toBeGreaterThan(2.6); // larger than a plant pin → the tap area grows
  });

  it("never divides by zero before the canvas has a size", () => {
    expect(Number.isFinite(unitsPerPixel(0))).toBe(true);
  });
});

describe("fitWithin", () => {
  it("leaves photos that already fit untouched", () => {
    expect(fitWithin(2048, 1024, 4096)).toEqual({ width: 2048, height: 1024, resized: false });
    expect(fitWithin(4096, 2048, 4096).resized).toBe(false);
  });

  it("scales an 8K photo down to 4096 wide, keeping 2:1", () => {
    expect(fitWithin(8192, 4096, 4096)).toEqual({ width: 4096, height: 2048, resized: true });
  });

  it("rounds odd sizes and never returns a zero height", () => {
    expect(fitWithin(5001, 2499, 4096)).toEqual({ width: 4096, height: 2047, resized: true });
    expect(fitWithin(100000, 3, 4096).height).toBe(1);
  });
});

describe("nearestPanoramas", () => {
  const here = pano("here", 0.2, 0.3);
  const near = pano("near", 0.3, 0.3);
  const mid = pano("mid", 0.2, 0.7);
  const far = pano("far", 0.9, 0.9);

  it("returns the other spots, nearest first", () => {
    const order = nearestPanoramas(farm, here, [far, here, mid, near]);
    expect(order.map((p) => p.id)).toEqual(["near", "mid", "far"]);
  });

  it("uses real map distance, not raw fractions", () => {
    // 0.2 across (320 px) is farther than 0.3 down (270 px) on a 1600×900 map.
    const across = pano("across", 0.4, 0.3);
    const down = pano("down", 0.2, 0.6);
    expect(nearestPanoramas(farm, here, [across, down])[0].id).toBe("down");
  });

  it("does not change the list it was given", () => {
    const list = [far, mid, near];
    nearestPanoramas(farm, here, list);
    expect(list.map((p) => p.id)).toEqual(["far", "mid", "near"]);
  });
});
