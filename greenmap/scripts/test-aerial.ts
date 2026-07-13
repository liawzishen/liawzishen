import { nadirSampleUV } from "../components/farm/tour/aerial";

let failures = 0;
function ok(name: string, cond: boolean) {
  if (cond) console.log("✓", name);
  else {
    console.error("✗", name);
    failures++;
  }
}
const approx = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) <= eps;

const S = 400;
const c = S / 2;

// Centre of the disc looks straight down = the bottom row of the equirect (v=1).
const centre = nadirSampleUV(c, c, S, 0);
ok("centre non-null", centre !== null);
ok("centre samples down (v≈1)", !!centre && approx(centre.v, 1));
ok("centre fully opaque", !!centre && centre.alpha === 1);

// Corners are outside the inscribed disc.
ok("corner → null", nadirSampleUV(0, 0, S, 0) === null);

// Degenerate tile size → null (no divide-by-zero / NaN).
ok("size 0 → null", nadirSampleUV(0, 0, 0, 0) === null);
ok("size <0 → null", nadirSampleUV(0, 0, -10, 0) === null);

// Top-centre pixel = map-north direction; at heading 0 it samples the photo centre column.
const north = nadirSampleUV(c, 0, S, 0);
ok("north non-null", north !== null);
ok("north heading0 → u≈0.5", !!north && approx(north.u, 0.5));
ok("rim alpha ≈ 0", !!north && approx(north.alpha, 0));

// Rotating the capture 90° shifts which column north samples.
const northE = nadirSampleUV(c, 0, S, 90);
ok("north heading90 → u≈0.25", !!northE && approx(northE.u, 0.25));

if (failures) {
  console.error(`\n${failures} assertion(s) failed`);
  process.exit(1);
}
console.log("\nAll aerial reprojection assertions passed.");
