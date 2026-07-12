# Auto-Generated Aerial 2D Background — Design Spec

**Date:** 2026-07-12
**Status:** Approved by user (both sections)
**Branch:** `farm-360-tour` (continues the 360° tour work)
**Depends on:** the farm 360° tour (`farm_panoramas` table, `components/farm/tour/`)

## Problem

The user wants the 2D map to be **auto-generated from the 360° captures**, Polycam-style —
"the 2D background does not changing yet" when panoramas are added. They want the 2D to
reflect what was actually scanned in 3D.

## Research (2026-07-12)

- **Polycam** generates measured 2D floor plans from **LiDAR depth + on-device/cloud
  processing** — requires the hardware depth sensor.
- **RICOH360** produces floor plans from 360° tours but as a **managed service** (submit
  tour → plan returned in a day or two), not a client algorithm.
- Academic methods vectorize a **LiDAR point cloud** (Hough transform on wall slices).
- **Consensus:** there is no reliable way to reconstruct a true, measured floor plan
  (walls/dimensions) from plain equirectangular photos without depth/LiDAR or a paid
  service.

**Therefore** a true floor plan is out of scope. For a farm (no walls/rooms) the feasible
and more useful auto-generated 2D is a **top-down aerial mosaic** built from the nadir
(straight-down) region of each 360° capture — an impressionistic bird's-eye of the real
field, not a survey.

## User decisions (locked)

1. **Direction:** top-down aerial mosaic from the captures' nadir (not a measured floor plan).
2. **Integration:** the generated mosaic **becomes the 2D background** (replaces the plain
   green/photo) when captures exist; markers + 360° badges stay on top; falls back to the
   current background when there are no captures.
3. **Generation:** **live in the browser** — normal background shows instantly, mosaic swaps
   in when reprojection finishes; no storage, no regenerate step.

## Technique

### Nadir reprojection (per panorama)

Equirectangular convention: pixel `(u,v)`, `u,v ∈ [0,1]`, maps to longitude/latitude
`λ = (u − 0.5)·2π`, `φ = (0.5 − v)·π` (φ = −π/2 is the nadir / bottom edge).

Because there is no depth, the disc is parameterized directly by **look-down angle**, not by
a metric ground extent (this removes the under-defined `R`/eye-height pair). For an output
tile of side `S` px, let the centre be `c = S/2`. For each output pixel `(px, py)`:

- normalized radius `ρ = hypot(px − c, py − c) / c` (0 at centre, 1 at the inscribed edge)
- if `ρ > 1` → fully transparent (corners outside the disc)
- azimuth `α = atan2(px − c, py − c)`
- tilt from straight-down `β = ρ · BETA_MAX` (linear azimuthal-equidistant map;
  `BETA_MAX = 70° = 1.2217 rad`). Centre = nadir, rim = `BETA_MAX`.
- source direction: `λ = α − headingRad`, `φ = β − π/2`
- source pixel: `u = wrap01(λ/(2π) + 0.5)`, `v = clamp01(0.5 − φ/π)`
- sample source at `(u,v)` (nearest-neighbour); write to output `(px,py)`.

**Edge fade:** alpha = `smoothstep(1, 0, (ρ − FADE_START)/(1 − FADE_START))` for
`ρ ≥ FADE_START (0.78)`, else `1`; `ρ > 1` is transparent. So each disc feathers to nothing
at its rim and blends with neighbours.

`wrap01(x) = x − floor(x)`; `clamp01(x) = min(1, max(0, x))`.

### Compositing

- Offscreen canvas sized to the farm canvas, capped at `MOSAIC_MAX = 1200` px on the long
  side (proportional to `canvas_width : canvas_height`).
- Each disc drawn centered at `(position_x·W, position_y·H)` with on-canvas radius
  `DISC_RADIUS_FRAC = 0.35 × min(W,H)`, using the disc's feathered alpha (`source-over`) so
  overlaps blend.
- Draw order: capture `created_at` ascending (stable).

### Orientation

`headingRad = headingDeg·π/180`, applied as the `azimuth − headingRad` offset above, so each
disc's north aligns with map-north. Consistent with the tour's world-space bearing model
(`tour/geometry.ts`).

## Architecture

### New files (2D path stays free of three.js — pure Canvas 2D, no new dependency)

| File | Responsibility |
|---|---|
| `greenmap/components/farm/tour/aerial.ts` | `reprojectNadir(source: CanvasImageSource & { width; height } \| ImageData, headingDeg: number, opts?: { size?: number }) => HTMLCanvasElement`. Pure; returns one feathered top-down disc (RGBA). Reads source via a scratch canvas `getImageData` once; nearest-neighbour sample. |
| `greenmap/components/farm/tour/useAerialMosaic.ts` | `useAerialMosaic(farm: Farm, panoramas: FarmPanorama[]) => { canvas: HTMLCanvasElement \| null; generating: boolean }`. Loads each panorama `Image` (crossOrigin="anonymous"), downscales to ≤1024×512, calls `reprojectNadir`, composites onto one offscreen canvas. Memoized on `panoramas.map(p => p.id + ":" + p.heading_deg).join()`. Runs after paint (`requestIdleCallback` fallback `setTimeout(…,0)`); returns `null` until ready. Cancels on unmount / dependency change (a disposed flag). |

### Wiring

- `FarmMap.tsx` (already owns `usePanoramas`): call
  `const aerial = useAerialMosaic(farm, mode === "2d" ? pano.panoramas : [])` so it only
  generates in 2D. Pass `aerialCanvas={aerial.canvas}` to `FarmMapCanvas`.
- `FarmMapCanvas.tsx`: new optional prop `aerialCanvas?: HTMLCanvasElement | null`. In the
  background `<Layer>`, background priority: **`aerialCanvas` (Konva `<Image image={aerialCanvas}>`)
  → `bgImage` (upload/satellite) → gradient + soil rows**. When `aerialCanvas` is present it
  fills `CANVAS_W × CANVAS_H` like the existing image branch. Everything else (markers,
  badges, zoom) unchanged.

### Performance

- Source downscaled to ≤1024×512 before sampling; output composite ≤1200 px long side.
- ~3 discs × ~400² ≈ 0.5M samples, ~100–200 ms one-time, off the paint → first 2D render
  instant, mosaic swaps in.
- Regenerates only when the panorama set (ids + headings) changes; otherwise cached.
- Revoke object URLs / drop canvases on cleanup.

### Fallbacks / errors

- Any panorama image load or draw failure → skip that disc; if all fail → `canvas = null`
  → existing background. No captures → `panoramas` empty → `canvas = null`. Generation is
  purely additive; the 2D map behaves exactly as today whenever it can't run.

### i18n

- One optional key `tour.generatingAerial` ("Building field view…" / "Membina paparan
  ladang…") for a subtle corner spinner while `generating` is true. No other strings.

## Out of scope

- Measured floor plans, walls, dimensions, metric scale (needs LiDAR/depth or a paid
  service). Persisting/saving the mosaic to storage. Multi-photo stitching/SfM. Editing the
  generated plan.

## Success criteria

- `npm run build` clean; `ms` mirrors `en`.
- `reprojectNadir` unit check: a half-black/half-white equirect yields a disc whose centre
  samples the down-direction (bottom row of the source) and whose corners (`ρ > 1`) are
  fully transparent.
- Demo farm's 2D shows a blended aerial built from the 3 seeded panoramas, updating when a
  new 360° photo is added; removing all panoramas returns the original background; a broken
  image URL falls back without breaking the map.
