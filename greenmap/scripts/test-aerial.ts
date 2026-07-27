import {
  nadirSampleUV,
  photoU,
  sphereYawRad,
  sphereWorldDir,
  bearingToWorldDir,
} from "../components/farm/tour/aerial";

let failures = 0;
function ok(name: string, cond: boolean) {
  if (cond) console.log("✓", name);
  else {
    console.error("✗", name);
    failures++;
  }
}
const approx = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) <= eps;
const RAD = Math.PI / 180;

// ---------------------------------------------------------------------------
// The shared world->photo transform (2D aerial and 3D sphere must agree)
// ---------------------------------------------------------------------------

// heading_deg is "the compass bearing the photo centre faces" (types/database).
for (const h of [0, 40, 90, -60, 180, 355]) {
  ok(
    `photoU: centre column faces heading ${h}°`,
    approx(photoU(h * RAD, h), 0.5)
  );
}
// u advances clockwise/east from the centre: +90° of bearing = +0.25 of u.
ok("photoU: +90° bearing → +0.25 u", approx(photoU(90 * RAD, 0), 0.75));
ok("photoU: −90° bearing → −0.25 u", approx(photoU(-90 * RAD, 0), 0.25));
ok("photoU: wraps into [0,1)", photoU(-300 * RAD, 170) >= 0);

// THE cross-view check: the column the 2D aerial samples for a bearing is the
// column the 3D sphere actually shows in that direction. A mismatch here is the
// bug where a heading calibrated in 3D rotated the aerial incorrectly.
let crossOk = true;
for (const h of [0, 37, 90, 145, -60, 180, -175, 359]) {
  for (const bDeg of [0, 23, 90, 135, 180, 250, 300, -45]) {
    const b = bDeg * RAD;
    const got = sphereWorldDir(photoU(b, h), h);
    const want = bearingToWorldDir(b);
    if (!approx(got.x, want.x, 1e-9) || !approx(got.z, want.z, 1e-9)) {
      crossOk = false;
      console.error(
        `   heading ${h}° bearing ${bDeg}°: got (${got.x.toFixed(4)}, ${got.z.toFixed(4)}) want (${want.x.toFixed(4)}, ${want.z.toFixed(4)})`
      );
    }
  }
}
ok("2D and 3D share one transform (64 heading×bearing pairs)", crossOk);

// Spot-check the 3D yaw against the world convention in geometry.ts
// (map north = −z, east = +x) so a regression names the direction that broke.
const n = sphereWorldDir(0.5, 0); // photo centre, heading 0 → must face north
ok("sphere: heading 0 puts centre on north", approx(n.x, 0) && approx(n.z, -1));
const e = sphereWorldDir(0.5, 90); // heading 90 → centre faces east
ok("sphere: heading 90 puts centre on east", approx(e.x, 1) && approx(e.z, 0));
ok("sphereYawRad(0) = −90°", approx(sphereYawRad(0), -Math.PI / 2));

// ---------------------------------------------------------------------------
// Nadir reprojection sampling
// ---------------------------------------------------------------------------

const S = 400;
const c = S / 2;
const ODD = 401; // odd size => a pixel centre lands exactly on the disc centre
const oc = (ODD - 1) / 2;

// Centre of the disc looks straight down = the bottom row of the equirect (v=1).
const centre = nadirSampleUV(oc, oc, ODD, 0);
ok("centre non-null", centre !== null);
ok("centre samples down (v≈1)", !!centre && approx(centre.v, 1));
ok("centre fully opaque", !!centre && centre.alpha === 1);

// Corners are outside the inscribed disc.
ok("corner → null", nadirSampleUV(0, 0, S, 0) === null);

// Degenerate tile size → null (no divide-by-zero / NaN).
ok("size 0 → null", nadirSampleUV(0, 0, 0, 0) === null);
ok("size <0 → null", nadirSampleUV(0, 0, -10, 0) === null);
// A 1px disc is degenerate but must not produce NaN.
const one = nadirSampleUV(0, 0, 1, 0);
ok("size 1 → finite sample", !!one && Number.isFinite(one.u) && one.alpha === 1);

// Top-centre pixel = map-north direction; at heading 0 it samples the photo
// centre column.
const north = nadirSampleUV(oc, 0, ODD, 0);
ok("north non-null", north !== null);
ok("north heading0 → u≈0.5", !!north && approx(north.u, 0.5));
ok("rim alpha ≈ 0", !!north && approx(north.alpha, 0));

// Rotating the capture 90° shifts which column north samples.
const northE = nadirSampleUV(oc, 0, ODD, 90);
ok("north heading90 → u≈0.25", !!northE && approx(northE.u, 0.25));

// Four-axis rim symmetry on an EVEN-sized disc. Walk inward from each edge
// along the near-axis line and record the first pixel that lands inside the
// disc. All four must appear at the same depth with the same feathered alpha.
// Indexing integer pixels as if they were centres made top/left reach ρ=1 while
// bottom/right stopped at ρ≈0.995, leaving a faint opaque rim on two sides.
const lo = c - 1; // the column/row just before the centre line
function firstInside(at: (k: number) => ReturnType<typeof nadirSampleUV>) {
  for (let k = 0; k < S; k++) {
    const s = at(k);
    if (s) return { depth: k, alpha: s.alpha };
  }
  return null;
}
const rims = {
  top: firstInside((k) => nadirSampleUV(lo, k, S, 0)),
  bottom: firstInside((k) => nadirSampleUV(lo, S - 1 - k, S, 0)),
  left: firstInside((k) => nadirSampleUV(k, lo, S, 0)),
  right: firstInside((k) => nadirSampleUV(S - 1 - k, lo, S, 0)),
};
ok(
  "even disc: all four axis rims exist",
  Object.values(rims).every((r) => r !== null)
);
ok(
  "even disc: rim starts at the same depth on all four sides",
  rims.top!.depth === rims.bottom!.depth &&
    rims.top!.depth === rims.left!.depth &&
    rims.top!.depth === rims.right!.depth
);
ok(
  "even disc: four-axis rim alpha is symmetric",
  approx(rims.top!.alpha, rims.bottom!.alpha) &&
    approx(rims.top!.alpha, rims.left!.alpha) &&
    approx(rims.top!.alpha, rims.right!.alpha)
);
// An even disc has no pixel exactly on an axis (both middle columns sit half a
// pixel off), so its outermost near-axis pixel lands at ρ≈0.995 rather than 1.
// What matters is that the leftover opacity is negligible AND identical on all
// four sides — asserted above. The exact axis pixel of an odd disc does reach
// alpha 0 ("rim alpha ≈ 0").
ok("even disc: rim fades to a negligible edge", rims.top!.alpha < 0.05);

// The same must hold for the odd case, where the axes sit on exact pixels.
const oddAxes = [
  nadirSampleUV(oc, 0, ODD, 0),
  nadirSampleUV(oc, ODD - 1, ODD, 0),
  nadirSampleUV(0, oc, ODD, 0),
  nadirSampleUV(ODD - 1, oc, ODD, 0),
];
ok(
  "odd disc: four-axis rim alpha is symmetric",
  oddAxes.every((a) => a !== null && approx(a.alpha, oddAxes[0]!.alpha))
);

// Bearings around the disc read the expected columns at heading 0 (u advances
// clockwise: N=0.5, E=0.75, S=0.0, W=0.25).
const east = nadirSampleUV(ODD - 1, oc, ODD, 0);
const south = nadirSampleUV(oc, ODD - 1, ODD, 0);
const west = nadirSampleUV(0, oc, ODD, 0);
ok("east rim → u≈0.75", !!east && approx(east.u, 0.75));
ok("south rim → u≈0.0", !!south && approx(south.u, 0));
ok("west rim → u≈0.25", !!west && approx(west.u, 0.25));

if (failures) {
  console.error(`\n${failures} assertion(s) failed`);
  process.exit(1);
}
console.log("\nAll aerial reprojection assertions passed.");
