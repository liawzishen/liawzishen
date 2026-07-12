// Pure nadir -> top-down reprojection for the auto-generated 2D aerial mosaic.
// No React / no "@/" imports so the math is unit-testable under `tsx`.

const BETA_MAX = (70 * Math.PI) / 180; // rim look-down angle
const FADE_START = 0.78; // ρ where the disc starts feathering to transparent
const TWO_PI = Math.PI * 2;

const wrap01 = (x: number) => x - Math.floor(x);
const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

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
 */
export function nadirSampleUV(
  px: number,
  py: number,
  size: number,
  headingDeg: number
): NadirSample | null {
  const c = size / 2;
  const dx = px - c;
  const dy = py - c;
  const rho = Math.hypot(dx, dy) / c;
  if (rho > 1) return null;

  // Map bearing (clockwise from north). dy points south, so north = -dy.
  const bearing = Math.atan2(dx, -dy);
  const beta = rho * BETA_MAX;
  const headingRad = (headingDeg * Math.PI) / 180;

  const lambda = bearing - headingRad; // photo centre (u=0.5) faces heading
  const phi = beta - Math.PI / 2; // β=0 → φ=-π/2 (nadir / bottom row)

  const u = wrap01(lambda / TWO_PI + 0.5);
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
      dst.data[di + 3] = (s.alpha * 255) | 0;
    }
  }
  octx.putImageData(dst, 0, 0);
  return out;
}
