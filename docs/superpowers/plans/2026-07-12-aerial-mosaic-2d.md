# Auto-Generated Aerial 2D Background Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Auto-generate a top-down aerial mosaic from the farm's 360° captures (reproject each panorama's nadir into a feathered disc, composite them) and use it as the 2D map background, so the 2D reflects what was scanned.

**Architecture:** A pure, unit-tested reprojection module (`aerial.ts`) maps output-disc pixels to equirectangular source coords by look-down angle. A React hook (`useAerialMosaic`) loads the panoramas, builds one disc each, and composites them onto an offscreen canvas — lazily, memoized on the capture set. `FarmMapCanvas` uses that canvas as its background when present, else falls back to today's photo/gradient. Plain Canvas 2D — three.js never enters the 2D path.

**Tech Stack:** Next.js 15 App Router, React 19, react-konva (2D map), TypeScript, plain Canvas 2D. `tsx` (existing devDep) runs the reprojection unit test in node.

**Spec:** `docs/superpowers/specs/2026-07-12-aerial-mosaic-2d-design.md`

## Global Constraints

- Branch: `farm-360-tour`. App lives in `greenmap/` — run all npm commands there. Never push to main.
- **No three.js / no new runtime dependency on the 2D path.** The mosaic is plain Canvas 2D.
- `aerial.ts` must not import from `@/` or React — keep it pure so `npx tsx` can unit-test it.
- Build gate (no test framework for UI): `npm run build` in `greenmap/` ends with `✓ Compiled successfully`. Run before each commit.
- The feature is **purely additive**: no captures, all images fail, or any generation error → the 2D map behaves exactly as today (photo/satellite → green gradient). The 2D must never break.
- Live generation only — **no storage / no persistence**. Generated in the browser, off the first paint.
- Any new user-visible string goes through `lib/i18n/dictionaries.ts` in BOTH `en` and `ms` (the `Dict = typeof en` type enforces the mirror).
- Reprojection constants (verbatim): `BETA_MAX = 70°`, `FADE_START = 0.78`; mosaic: `DISC = 400`, source downscale `1024×512`, `MOSAIC_MAX = 1200`, `DISC_RADIUS_FRAC = 0.35`.
- Commit messages end with:
  `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`
  `Claude-Session: https://claude.ai/code/session_01TwNP4Ghj3CkcHdDt7knBbM`
- **Edit location:** this session is isolated to the worktree; make edits under `.claude/worktrees/press-feedback-desktop/greenmap/…`. After a green build + commit in the worktree, the controller fast-forwards the main checkout so `localhost:3000` reflects it.

---

### Task 1: `aerial.ts` — nadir reprojection (pure math + canvas), unit-tested

**Files:**
- Create: `greenmap/components/farm/tour/aerial.ts`
- Create: `greenmap/scripts/test-aerial.ts` (tsx assert script)

**Interfaces:**
- Produces:
  - `interface NadirSample { u: number; v: number; alpha: number }`
  - `nadirSampleUV(px: number, py: number, size: number, headingDeg: number): NadirSample | null` — pure; corners (`ρ > 1`) → `null`.
  - `reprojectNadir(source: CanvasImageSource, sourceW: number, sourceH: number, headingDeg: number, size?: number): HTMLCanvasElement` — one feathered top-down disc (default `size = 400`). Browser-only (uses `document`), but only inside the function body, so importing the module in node is safe.

- [ ] **Step 1: Write the failing test**

Create `greenmap/scripts/test-aerial.ts`:

```ts
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
```

- [ ] **Step 2: Run the test — verify it fails**

Run (from `greenmap/`): `npx tsx scripts/test-aerial.ts`
Expected: FAIL — `Cannot find module '../components/farm/tour/aerial'` (file doesn't exist yet).

- [ ] **Step 3: Implement `aerial.ts`**

Create `greenmap/components/farm/tour/aerial.ts`:

```ts
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
```

- [ ] **Step 4: Run the test — verify it passes**

Run (from `greenmap/`): `npx tsx scripts/test-aerial.ts`
Expected: PASS — all lines print `✓` and `All aerial reprojection assertions passed.`

- [ ] **Step 5: Build gate**

Run (from `greenmap/`): `npm run build`
Expected: `✓ Compiled successfully` (the module compiles; nothing imports it yet).

- [ ] **Step 6: Commit**

```bash
git add greenmap/components/farm/tour/aerial.ts greenmap/scripts/test-aerial.ts
git commit -m "feat: pure nadir->top-down reprojection for the 2D aerial (unit-tested)"
```

---

### Task 2: `useAerialMosaic` hook + wire into the 2D map

**Files:**
- Create: `greenmap/components/farm/tour/useAerialMosaic.ts`
- Modify: `greenmap/components/farm/FarmMapCanvas.tsx` (background priority + new prop)
- Modify: `greenmap/components/farm/FarmMap.tsx` (call hook, pass canvas, optional spinner)
- Modify: `greenmap/lib/i18n/dictionaries.ts` (one key, en + ms)

**Interfaces:**
- Consumes: `reprojectNadir` (Task 1); `Farm`, `FarmPanorama` from `@/types/database`; `usePanoramas().panoramas` (already in FarmMap).
- Produces: `useAerialMosaic(farm: Farm, panoramas: FarmPanorama[]): { canvas: HTMLCanvasElement | null; generating: boolean }`.
- `FarmMapCanvas` gains optional prop `aerialCanvas?: HTMLCanvasElement | null`.
- Dictionary key `t.tour.generatingAerial`.

- [ ] **Step 1: Implement the hook**

Create `greenmap/components/farm/tour/useAerialMosaic.ts`:

```ts
"use client";

import { useEffect, useRef, useState } from "react";
import type { Farm, FarmPanorama } from "@/types/database";
import { reprojectNadir } from "./aerial";

const DISC = 400; // per-disc output resolution
const SRC_W = 1024; // downscaled source width
const SRC_H = 512; // downscaled source height
const MOSAIC_MAX = 1200; // composite long-side cap (px)
const DISC_RADIUS_FRAC = 0.35; // disc radius as a fraction of min(mosaic side)

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("aerial: image load failed"));
    img.src = url;
  });
}

/**
 * Build a top-down aerial mosaic from the farm's 360° captures and return it
 * as a canvas to use as the 2D map background. Lazy (runs after paint) and
 * memoized on the capture set (ids + headings). Returns null — so the caller
 * keeps its normal background — when there are no captures or on any failure.
 * Live, browser-only, no storage.
 */
export function useAerialMosaic(farm: Farm, panoramas: FarmPanorama[]) {
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);
  const [generating, setGenerating] = useState(false);
  const key = panoramas.map((p) => `${p.id}:${p.heading_deg}`).join("|");
  const started = useRef(false);

  useEffect(() => {
    started.current = false;
    if (panoramas.length === 0) {
      setCanvas(null);
      setGenerating(false);
      return;
    }
    let disposed = false;

    const run = async () => {
      if (disposed || started.current) return;
      started.current = true;
      setGenerating(true);
      try {
        const w = farm.canvas_width;
        const h = farm.canvas_height;
        const long = Math.max(w, h);
        const s = long > MOSAIC_MAX ? MOSAIC_MAX / long : 1;
        const mw = Math.max(1, Math.round(w * s));
        const mh = Math.max(1, Math.round(h * s));
        const out = document.createElement("canvas");
        out.width = mw;
        out.height = mh;
        const ctx = out.getContext("2d")!;
        const radius = DISC_RADIUS_FRAC * Math.min(mw, mh);

        const ordered = [...panoramas].sort((a, b) =>
          a.created_at < b.created_at ? -1 : 1
        );
        let drew = 0;
        for (const p of ordered) {
          if (disposed) return;
          let img: HTMLImageElement;
          try {
            img = await loadImage(p.image_url);
          } catch {
            continue; // skip a broken photo, keep going
          }
          const disc = reprojectNadir(img, SRC_W, SRC_H, p.heading_deg, DISC);
          const cx = p.position_x * mw;
          const cy = p.position_y * mh;
          ctx.drawImage(disc, cx - radius, cy - radius, radius * 2, radius * 2);
          drew++;
        }
        if (disposed) return;
        setCanvas(drew > 0 ? out : null);
      } catch {
        if (!disposed) setCanvas(null);
      } finally {
        if (!disposed) setGenerating(false);
      }
    };

    // Run after paint so the normal background shows first, then swaps in.
    let handle: number;
    const ric = (
      globalThis as unknown as {
        requestIdleCallback?: (cb: () => void) => number;
      }
    ).requestIdleCallback;
    if (ric) handle = ric(() => void run());
    else handle = window.setTimeout(() => void run(), 0);

    return () => {
      disposed = true;
      const cic = (
        globalThis as unknown as {
          cancelIdleCallback?: (h: number) => void;
        }
      ).cancelIdleCallback;
      if (ric && cic) cic(handle);
      else window.clearTimeout(handle);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, farm.canvas_width, farm.canvas_height]);

  return { canvas, generating };
}
```

- [ ] **Step 2: Add the dictionary key (en + ms)**

In `greenmap/lib/i18n/dictionaries.ts`, in the **en** `tour` object, after `cancel: "Cancel",` add:

```ts
    generatingAerial: "Building field view…",
```

In the **ms** `tour` object, after `cancel: "Batal",` add:

```ts
    generatingAerial: "Membina paparan ladang…",
```

- [ ] **Step 3: Add the `aerialCanvas` prop to FarmMapCanvas**

In `greenmap/components/farm/FarmMapCanvas.tsx`, extend the `Props` interface (right after the `onPanoramaClick?` line added earlier):

```ts
  /** Generated top-down aerial mosaic; when set, it is the map background. */
  aerialCanvas?: HTMLCanvasElement | null;
```

Add `aerialCanvas` to the destructured parameters (next to `panoramas, onPanoramaClick`):

```ts
  panoramas,
  onPanoramaClick,
  aerialCanvas,
}: Props) {
```

- [ ] **Step 4: Use the aerial as the background**

In `greenmap/components/farm/FarmMapCanvas.tsx`, replace the background-branch block:

```tsx
        {/* Background */}
        <Layer listening={false}>
          {bgImage ? (
            <KonvaImage image={bgImage} width={CANVAS_W} height={CANVAS_H} />
          ) : (
```

with (adds the aerial as the top-priority background; the rest is unchanged):

```tsx
        {/* Background: generated aerial → farm photo/satellite → gradient */}
        <Layer listening={false}>
          {aerialCanvas ? (
            <KonvaImage
              image={aerialCanvas}
              width={CANVAS_W}
              height={CANVAS_H}
            />
          ) : bgImage ? (
            <KonvaImage image={bgImage} width={CANVAS_W} height={CANVAS_H} />
          ) : (
```

(The existing `) : (` … gradient `<Group>` … `)}` tail stays exactly as-is — this only changes the opening `{bgImage ? (` into `{aerialCanvas ? (…) : bgImage ? (`.)

- [ ] **Step 5: Wire the hook in FarmMap**

In `greenmap/components/farm/FarmMap.tsx`:

(a) Add the import near the other tour imports:

```tsx
import { useAerialMosaic } from "./tour/useAerialMosaic";
```

(b) After `const pano = usePanoramas(farm.id);` add:

```tsx
  // Auto-generated top-down aerial from the 360° captures — becomes the 2D
  // background (only computed in 2D; empty list in 3D means no work).
  const aerial = useAerialMosaic(farm, mode === "2d" ? pano.panoramas : []);
```

(c) Pass it to the 2D canvas — extend the `<FarmMapCanvas …>` props (next to `panoramas`/`onPanoramaClick`):

```tsx
          aerialCanvas={aerial.canvas}
```

(d) Add a subtle "building" pill. Directly after the care-filter toggle block (the block that ends the `{mode === "2d" && careIds.length > 0 && !placing && ( … )}`), add:

```tsx
      {/* Aerial generation hint */}
      {mode === "2d" && aerial.generating && (
        <div className="pointer-events-none absolute right-3 bottom-16 z-10 rounded-full bg-label/80 px-3 py-1 text-[11px] font-medium text-white">
          {t.tour.generatingAerial}
        </div>
      )}
```

- [ ] **Step 6: Build gate**

Run (from `greenmap/`): `npm run build`
Expected: `✓ Compiled successfully`. Watch for TS errors on the new prop and the `t.tour.generatingAerial` key (missing `ms` mirror would fail the build).

- [ ] **Step 7: Commit**

```bash
git add greenmap/components/farm/tour/useAerialMosaic.ts greenmap/components/farm/FarmMapCanvas.tsx greenmap/components/farm/FarmMap.tsx greenmap/lib/i18n/dictionaries.ts
git commit -m "feat: 2D map background is a live aerial mosaic built from 360 captures"
```

---

## Manual verification (after both tasks, on the demo farm)

- Ladang Hijau → Map: after a beat, the plain green background is replaced by a soft
  top-down mosaic built from the 3 seeded panoramas; plant markers + blue 360° badges
  still sit on top; a brief "Building field view…" pill shows while it generates.
- Add another 360° photo (＋ 360° in the 3D tour) → return to 2D → the mosaic rebuilds
  including the new spot.
- Temporarily break a panorama's URL (or a farm with none) → the 2D shows the original
  background, no error.
- `mode` 3D → the aerial isn't computed (hook gets an empty list); switching back to 2D
  rebuilds it and the map is not blank (Task-independent: relies on the earlier remount fix).

## Self-review notes (done)

- **Spec coverage:** nadir reprojection + fade (Task 1); heading orientation (Task 1
  `nadirSampleUV` heading term); compositing/DISC_RADIUS_FRAC/MOSAIC_MAX + lazy + memo +
  fallback (Task 2 hook); becomes-background priority (Task 2 Step 4); i18n key (Task 2
  Step 2); no-three.js/Canvas-2D (aerial.ts + hook use only Canvas 2D). All covered.
- **Type consistency:** `reprojectNadir(source, sourceW, sourceH, headingDeg, size?)` and
  `nadirSampleUV(px, py, size, headingDeg)` used identically in Task 2. `aerialCanvas`
  prop name consistent across FarmMapCanvas + FarmMap.
