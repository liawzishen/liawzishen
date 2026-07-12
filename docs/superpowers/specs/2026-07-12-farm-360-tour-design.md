# Farm 360° Tour — Design Spec

**Date:** 2026-07-12
**Status:** Approved by user (both sections, via design-review artifact)
**Branch:** `farm-360-tour` (stacked on `map-3d-walk`)
**Replaces:** the synthetic first-person walk (`components/farm/walk/`, spec'd 2026-07-11)

## Problem

The user reviewed the computer-drawn 3D walk and said it is "not so correct." The
reference is **Matterport**: capture real surrounding photos, convert them to 360°
panoramas you stand inside, walk between capture spots, and flip to a 2D view.

## Research (Matterport model)

- **Capture:** camera placed at several *scan points*; each captures a full 360°
  image. Phone or 360° camera both work; stitching happens in the camera app /
  their cloud, not the viewer.
- **Walkthrough:** viewer stands inside a 360° photo; semi-transparent white
  circles on the floor mark other scan points; click → glide there. Drag to look,
  keyboard also works.
- **Mattertags:** colored pins anchored in the space; tap → info card.
- **Floor Plan:** top-down 2D view of the space with scan points.
- **Dollhouse:** orbitable 3D mesh — requires lidar/depth + server reconstruction.
  **Not reproducible from phone photos in a browser; explicitly out of scope.**

## User decisions (locked)

1. **Photo source:** farmer shoots 360° photos with phone (panorama/photo-sphere
   mode) or a 360 camera, uploads them; demo farm ships with sample panoramas.
2. **Old walk:** **replaced** — the Map tab's 3D toggle now opens the 360° tour;
   `components/farm/walk/` is deleted. Farms with no panoramas see an empty-state
   CTA instead.
3. **Plant tags:** yes — Mattertag-style pins inside panoramas open the existing
   `PlantBottomSheet`.
4. **Approach:** A — linked photo-spheres on the already-installed three.js
   (`three` + `@react-three/fiber`, lazy chunk). No new runtime dependencies.

## Architecture

### Data (migration `supabase/migrations/0009_panoramas.sql`)

```sql
create table farm_panoramas (
  id          uuid primary key default gen_random_uuid(),
  farm_id     uuid not null references farms(id) on delete cascade,
  image_url   text not null,
  position_x  double precision not null,  -- fraction of canvas_width (same as plants)
  position_y  double precision not null,  -- fraction of canvas_height
  heading_deg double precision not null default 0,  -- compass direction of image center
  label       text,
  created_at  timestamptz not null default now()
);

create table panorama_plant_tags (
  id           uuid primary key default gen_random_uuid(),
  panorama_id  uuid not null references farm_panoramas(id) on delete cascade,
  plant_id     uuid not null references plants(id) on delete cascade,
  yaw          double precision not null,   -- radians on the sphere
  pitch        double precision not null,   -- radians
  created_at   timestamptz not null default now(),
  unique (panorama_id, plant_id)
);
```

- RLS: same owner-scoped pattern as `plants` (owner full CRUD via farm ownership;
  select scoped the same way the rest of the farm data is).
- Storage: new bucket `farm-panoramas` (public read, authenticated write),
  copying the `0004_storage.sql` policy pattern (extend the policy lists).
- `types/database.ts` gains `FarmPanorama` and `PanoramaPlantTag` interfaces.

### Module layout (`greenmap/components/farm/tour/`)

| File | Responsibility |
|---|---|
| `FarmTour.tsx` | Composition: Canvas + current panorama + overlays; dynamic-imported by FarmMap (`ssr:false`) |
| `PanoramaSphere.tsx` | Inverted sphere with equirectangular texture (SRGB), crossfade between textures |
| `LookControls.tsx` | Drag-to-look (single-pointer guard, yaw/pitch clamp ±75°, "YXZ"), same feel as the old WalkRig |
| `HopCircles.tsx` | White floor rings toward neighbor panoramas; bearing = atan2 on 2D map deltas (aspect-scaled by canvas_width/height) minus `heading_deg`; tap → preload → 250 ms crossfade → switch |
| `PlantTagPins.tsx` | Sprite pins at (yaw,pitch), reusing `markerTexture` health colors; tap → `onMarkerClick(plant)` |
| `TagEditorOverlay.tsx` | Owner-only: "Tag plant" mode → tap sphere (raycast → yaw/pitch) → plant picker list → insert tag; tapping an existing pin in edit mode removes it (confirm) |
| `AddPanoramaSheet.tsx` | Upload flow: file pick → aspect check (warn — don't block — if width/height deviates from 2:1 by >10%) + ≤12 MB cap → tap standing spot on mini 2D map → upload to bucket + insert row; optional compass slider ("Set direction") editing `heading_deg` |
| `TourEmptyState.tsx` | "Add your first 360° photo" CTA + one-line phone how-to |
| `usePanoramas.ts` | Fetch/insert/update/delete panoramas + tags via supabase client |

### FarmMap integration

- `mode === "3d"` renders `FarmTour` (replacing `FarmWalk`); 2D stays default;
  toggle button unchanged.
- Optional `startId`: tapping a **360° badge** on the 2D canvas (small circle at
  each panorama's position) enters 3D at that panorama.
- `PlantBottomSheet` serves both modes (unchanged).
- The care filter / FAB / placement flows remain 2D-only, as today.

### Viewer behavior

- Camera at sphere center, fov 75, `dpr [1,1.75]`, no shadows.
- Hop circles sit slightly below the horizon (pitch ≈ −20°) at the computed yaw;
  nearer neighbors render slightly larger. Tap target ≥ 44 px.
- Crossfade: incoming texture preloaded before the 250 ms fade (no black flash);
  loading spinner if network is slow.
- Hint pill (top center): "Drag to look around · tap a circle to move" (EN/BM).

### Demo seeding

- 3 CC0 farmland equirectangular JPEGs (~2048×1024, few hundred KB each)
  committed under `greenmap/public/demo/pano-1.jpg … pano-3.jpg`, sourced from a
  CC0 library (e.g. Poly Haven tonemapped previews). If sourcing fails during
  implementation, generate stylized equirectangular farm images procedurally
  (canvas-drawn sky/horizon/rows) as the committed fallback.
- `scripts/seed-panoramas.ts` (npm script `seed:panoramas`, service-role like the
  other seeds): inserts the 3 panoramas at three spots on *Ladang Hijau* with
  `image_url` pointing at the committed `/demo/` files, plus 2–3 plant tags each
  on real seeded plants.

### i18n (both `en` and `ms`, type-enforced)

New `tour` namespace: `hint`, `addPhoto`, `addFirst`, `addFirstHow`, `tagPlant`,
`tapSpot`, `pickPlant`, `removeTag`, `setDirection`, `uploading`, `photoTooBig`,
`notPanorama`, `loadFailed`, `loading`. Remove `walkHint` (walk-specific); keep
`loading3d`/`switchTo3d`/`switchTo2d` — the 2D⇄3D toggle remains.

### Error handling

- Texture load failure → toast-style message, remain in / return to 2D.
- Upload failures named: too large, wrong aspect, storage/migration missing
  (friendly "run migration 0009" style message consistent with existing
  troubleshooting copy).
- All writes owner-only via RLS; UI hides editor affordances for non-owners.

### Performance

- three.js stays a lazy async chunk; Map tab first-load unchanged.
- One full-res texture in GPU memory at a time + neighbor prefetch (JS image
  cache); recommend 4096×2048 max in the upload hint.

## Out of scope

- Dollhouse/3D mesh reconstruction, in-browser stitching, auto-alignment of
  capture spots, live in-app camera capture, panorama hotlinking from Street View.

## Success criteria

- `npm run build` compiles clean; `ms` mirrors `en` (type-enforced).
- Demo farm: 3D toggle → real panorama; hop circles move between the 3 spots;
  tapping a pinned plant opens its sheet; 2D badges enter the tour; empty farm
  shows the CTA; upload flow works end-to-end on a farm the user owns.
- `components/farm/walk/` no longer exists; no dangling imports.
