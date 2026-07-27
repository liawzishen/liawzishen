// The single world->photo transform shared by the 2D aerial and the 3D sphere,
// plus the pure nadir -> top-down reprojection built on it.
// No React / no "@/" imports so the math is unit-testable under `tsx`.

const BETA_MAX = (70 * Math.PI) / 180; // rim look-down angle
const FADE_START = 0.78; // ρ where the disc starts feathering to transparent
const TWO_PI = Math.PI * 2;
const DEG = Math.PI / 180;

const wrap01 = (x: number) => x - Math.floor(x);
const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

/**
 * THE world->photo transform. `heading_deg` is defined (types/database.ts) as
 * the compass bearing the photo CENTRE faces, so the column u=0.5 must sit at
 * bearing = heading, and u advances clockwise (east) from there.
 *
 * @param bearingRad map bearing, radians clockwise from map-north (−z).
 * @returns equirect longitude coord u in [0,1).
 */
export function photoU(bearingRad: number, headingDeg: number): number {
  return wrap01((bearingRad - headingDeg * DEG) / TWO_PI + 0.5);
}

/**
 * The same transform expressed for the 3D view: the `rotation-y` (radians) to
 * put on the panorama group so the mirrored equirect sphere obeys `photoU`.
 *
 * Derivation — three.js SphereGeometry emits x = −R·cos(2πu), z = R·sin(2πu)
 * for texture column u; the mesh's scale=[-1,1,1] flips x to +R·cos(2πu); a
 * rotation-y of `a` then sends it to (R·cos(2πu−a), R·sin(2πu−a)). Setting
 * a = −(heading+90°) makes that direction equal bearing 360(u−0.5)+heading,
 * which is exactly `photoU` inverted. Without the −90° the photo centre lands
 * on west, and without the sign flip heading rotates the sphere backwards.
 */
export function sphereYawRad(headingDeg: number): number {
  return -(headingDeg + 90) * DEG;
}

/**
 * Unit world direction (y=0) that equirect column `u` ends up facing in the 3D
 * scene, modelling SphereGeometry + the x-mirror + `sphereYawRad`. Exists so
 * the round trip `sphereWorldDir(photoU(b, h), h) === bearing b` is provable in
 * tests — this is what keeps the 2D aerial and the 3D sphere in lockstep.
 */
export function sphereWorldDir(
  u: number,
  headingDeg: number
): { x: number; z: number } {
  const phi = TWO_PI * u;
  const a = sphereYawRad(headingDeg);
  // Mirrored geometry at the equator, then rotated by `a` about +y.
  const x0 = Math.cos(phi);
  const z0 = Math.sin(phi);
  return {
    x: x0 * Math.cos(a) + z0 * Math.sin(a),
    z: -x0 * Math.sin(a) + z0 * Math.cos(a),
  };
}

/** Map bearing (radians clockwise from north) → unit world direction. */
export function bearingToWorldDir(bearingRad: number): {
  x: number;
  z: number;
} {
  return { x: Math.sin(bearingRad), z: -Math.cos(bearingRad) };
}

export interface NadirSample {
  u: number; // 0..1 source longitude coord
  v: number; // 0..1 source latitude coord
  alpha: number; // 0..1 feathered opacity
}

/**
 * For an output disc of side `size`, map pixel (px,py) to the equirectangular
 * (u,v) it should sample, plus a feathered alpha. Returns null for corners
 * outside the inscribed disc (ρ > 1). Pure — no canvas.
 *
 * Tile pixels increase down/right = map south/east; ρ (0 centre → 1 rim) maps
 * linearly to look-down angle β (0 = straight down → BETA_MAX at the rim).
 *
 * (px,py) are integer pixel indices treated as pixel CENTRES (px+0.5), and ρ is
 * normalised by the distance to the outermost centre — so the four axis-extreme
 * pixels all land on ρ=1 and fade out together. Indexing by the bare integer
 * puts the rim at ρ=1 on the top/left but only ρ≈0.995 on the bottom/right of
 * an even-sized disc, leaving a faint one-sided seam.
 */
export function nadirSampleUV(
  px: number,
  py: number,
  size: number,
  headingDeg: number
): NadirSample | null {
  if (size <= 0) return null;
  const c = size / 2;
  const dx = px + 0.5 - c;
  const dy = py + 0.5 - c;
  // Half-extent measured between outermost pixel centres, not tile edges.
  const half = (size - 1) / 2;
  const rho = half > 0 ? Math.hypot(dx, dy) / half : 0;
  if (rho > 1) return null;

  // Map bearing (clockwise from north). dy points south, so north = -dy.
  const bearing = Math.atan2(dx, -dy);
  const beta = rho * BETA_MAX;
  const phi = beta - Math.PI / 2; // β=0 → φ=-π/2 (nadir / bottom row)

  const u = photoU(bearing, headingDeg);
  const v = clamp01(0.5 - phi / Math.PI);
  const alpha =
    rho <= FADE_START ? 1 : clamp01(1 - (rho - FADE_START) / (1 - FADE_START));

  return { u, v, alpha };
}

/**
 * Reproject one equirectangular panorama into a feathered top-down disc.
 * `source` is drawn to a scratch canvas at sourceW×sourceH (a downscale) so
 * we can read its pixels; the output is a `size`×`size` RGBA canvas.
 * Browser-only (needs `document`).
 */
export function reprojectNadir(
  source: CanvasImageSource,
  sourceW: number,
  sourceH: number,
  headingDeg: number,
  size = 400
): HTMLCanvasElement {
  const scratch = document.createElement("canvas");
  scratch.width = sourceW;
  scratch.height = sourceH;
  const sctx = scratch.getContext("2d")!;
  sctx.drawImage(source, 0, 0, sourceW, sourceH);
  const src = sctx.getImageData(0, 0, sourceW, sourceH).data;

  const out = document.createElement("canvas");
  out.width = size;
  out.height = size;
  const octx = out.getContext("2d")!;
  const dst = octx.createImageData(size, size);

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const di = (py * size + px) * 4;
      const s = nadirSampleUV(px, py, size, headingDeg);
      if (!s) {
        dst.data[di + 3] = 0;
        continue;
      }
      const sx = Math.min(sourceW - 1, (s.u * sourceW) | 0);
      const sy = Math.min(sourceH - 1, (s.v * sourceH) | 0);
      const si = (sy * sourceW + sx) * 4;
      dst.data[di] = src[si];
      dst.data[di + 1] = src[si + 1];
      dst.data[di + 2] = src[si + 2];
      // Feather MODULATES the source alpha — PNG/WebP panoramas are accepted,
      // so a transparent source pixel must stay transparent instead of being
      // promoted to an opaque (usually black) one.
      dst.data[di + 3] = (s.alpha * src[si + 3]) | 0;
    }
  }
  octx.putImageData(dst, 0, 0);
  return out;
}
