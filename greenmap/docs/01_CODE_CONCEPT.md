# 01 — GreenMap Code Concept
> Maintenance and code-review reference · How the program works and where to change things
> Schema/RLS/route details live in `docs/03_BACKEND_TRUTH.md` — this doc explains the *concept*.

---

## 1. Overall Program Concept

GreenMap is a Next.js (App Router) app where **Supabase is the backend** and the frontend talks to it directly under Row Level Security. Server API routes exist only where a secret key or a trusted calculation is involved (Gemini, health score writes, passport generation). There are exactly three places where AI works — Gemini Vision scan, Gemini Text suggestion, and the deterministic health score engine — everything else is plain CRUD.

```
            ┌────────────── BROWSER (Next.js pages/components) ──────────────┐
            │ reads/writes own data via supabase-js (anon key + RLS)         │
            │ uploads images to Storage buckets                              │
            └───────┬─────────────────────────────────────┬──────────────────┘
                    │ simple CRUD (farms, plants, logs)    │ trusted operations
                    ▼                                      ▼
            ┌── SUPABASE ──┐                   ┌── NEXT API ROUTES (server) ──┐
            │ Postgres+RLS │◄── service role ──│ /api/ai/scan      (Gemini)   │
            │ Auth         │                   │ /api/ai/save-scan (writes)   │
            │ Storage ×3   │                   │ /api/ai/suggest   (Gemini)   │
            └──────────────┘                   │ /api/health/recalculate      │
                                               │ /api/passports/generate      │
                                               └──────────────────────────────┘
```

**Rule of thumb:** if the value is *calculated* (`health_score`, `ai_sub_score`, badge booleans, passport aggregates) it is written **server-side**. If the value is *what the grower typed* (farm, plant, log) the client writes it directly under RLS.

---

## 2. Frontend Structure

- **Routing:** flat App Router (no `src/`). Public server components: Landing, Consumer QR View. Everything auth-gated is client-rendered behind `middleware.ts` (session check → redirect to `/auth`).
- **Tab shell (decision D2):** `AppShell` renders the 5-tab bar (Home · Map · Scan · Sales · Profile) on top-level grower pages; pushed sub-pages (setup wizard, plant detail, scan, timeline, harvest) use `TopNav` with a back arrow and no tab bar — exactly the `06` navigation model.
- **State:**
  - `FarmSetupContext` — holds wizard Steps 1–3; DB write happens once on Step 3 ("Enter My Farm"). Refresh mid-wizard = restart (accepted).
  - Active farm comes from the `[farmId]` route segment — no global farm store needed.
  - AI suggestion cache — `sessionStorage` entry `{ plantId, suggestion, generatedAt }`, reused within 60 minutes.
- **Component responsibilities (key ones):**

| Component | Responsibility |
|---|---|
| `farm/FarmMap.tsx` | Map container: holds plants + a single `selectedPlant` state; a single tap opens the `PlantBottomSheet`; placement mode (the Konva stage/pan/zoom live in `FarmMapCanvas`) |
| `farm/PlantMarker.tsx` | Solid high-contrast band-colour circle + always-visible white status icon (D10); selected pop via Konva tween; grey when score is NULL; single tap → select |
| `farm/AddPlantModal.tsx` | Name/type/zone/expected-harvest inputs → insert plant + `planted` log |
| `farm/PlantBottomSheet.tsx` + `farm/LogModal.tsx` | Single-tap summary sheet (score, status, facts) with quick actions → `LogModal` (Water/Fertilize/Note) writes `growth_logs` + calls `/api/health/recalculate`; both built on the reusable `ui/BottomSheet` (D10) |
| `plant/HealthScoreCard.tsx` | Big number + status label; shows *live* score (passive decay) from `lib/health/calculate.ts` |
| `plant/QuickActions.tsx` + `LogModal.tsx` | Water/Fertilize/Note modals → `growth_logs` insert with `metadata` → call recalculate |
| `plant/HealthTrendChart.tsx` | Recharts line from `health_score_history` (7 days) |
| `plant/ActivityTimeline.tsx` | Chronological `growth_logs` render; reused inline (limited) and on the full page |
| `ai/ScanUploader.tsx` / `AIScanResultCard.tsx` | Upload→preview→loading; result + Save/Scan-Again buttons |
| `passport/HarvestPassportCard.tsx` / `TrustBadges.tsx` / `QrBlock.tsx` | Certificate card; earned-only badges; QR + share/download |

- **Design tokens:** colors/type/radius from `06` §5–7 live in Tailwind config + CSS variables — change theme there, never inline.

---

## 3. Backend Structure

| Route | Why server-side | Reads | Writes |
|---|---|---|---|
| `POST /api/ai/scan` | `GEMINI_API_KEY` secret; output validation | image URL, crop type | nothing (returns result only) |
| `POST /api/ai/save-scan` | calculated `ai_sub_score` must be trusted | validated result | `ai_analyses`, `growth_logs(ai_scan)`, then recalc |
| `POST /api/ai/suggest` | Gemini key | plant context | nothing (session-cached client-side) |
| `POST /api/health/recalculate` | score is a trusted calculated value | latest scan/logs/status | `plants.health_score`, `health_score_history` |
| `POST /api/passports/generate` | multi-table aggregate snapshot must be consistent | logs, analyses, history | `harvest_passports`, `growth_logs(harvested)`, `plants.lifecycle_status` |
| `POST /api/mapbox/satellite` *(optional)* | Mapbox token secret | address/coords | nothing |

Supabase clients: `lib/supabase/client.ts` (browser, anon), `server.ts` (server components, cookie session), `admin.ts` (service role — **API routes and the QR page only**, never imported into client code).

---

## 4. Supabase Table Relationships

```
profiles 1─* farms 1─* zones
                  1─* plants 1─* growth_logs
                              1─* ai_analyses
                              1─* health_score_history
                              1─1 harvest_passports (0 or 1)
```
Access control flows down the `farms.user_id` chain — see `03_BACKEND_TRUTH.md` §5 for the policies.

---

## 5. Health Score Calculation Flow

`lib/health/calculate.ts` is a **pure function** — no DB calls — used in two places:

1. **Server (writes):** `/api/health/recalculate` runs after the four explicit events (water log, fertilize log, scan saved, manual status change) → updates `plants.health_score` → inserts a `health_score_history` snapshot.
2. **Client (display only):** Plant Detail and Farm Map recompute on load using stored dates, so the displayed number reflects passive decay. **Never written back.** This is why the map and detail page always agree.

```
score = round(ai×0.40 + watering×0.25 + fertilizer×0.20 + manual×0.15)
ai        = latest ai_analyses.ai_sub_score, default 50
watering  = max(0, 100 − daysSinceWater × 10), default 0 if never
fertilizer= max(0, 100 − daysSinceFertilize × 8), default 0 if never
manual    = healthy 100 / attention 50 / critical 0 (default attention)
```

New plant rule (D4): `health_score` stays **NULL** (grey "New" marker) until the first scoring event fires the first recalculation. Bands: 70–100 green · 40–69 amber · 0–39 red · NULL grey.

---

## 6. AI Scan Flow

```
upload photo → Storage(plant-scans) → POST /api/ai/scan {imageUrl, cropType, plantId}
  → Gemini Vision (structured JSON prompt)
  → validate: JSON parse (1 retry w/ stricter prompt) → severity enum → confidence clamp
  → map severity → ai_sub_score (none 95 / mild 75 / moderate 50 / severe 20)
  → return result            ── NOT SAVED ──
grower reviews → "Save to Plant Record" → POST /api/ai/save-scan
  → insert ai_analyses → insert growth_logs(event_type='ai_scan', metadata)
  → recalculate + snapshot → marker updates on next load
("Scan Again" simply discards — nothing was written.)
Gemini total failure → fallback object {diagnosis:"Unable to analyze", severity:"none", confidence:0, ai_sub_score:50}.
```

## 7. AI Suggestion Flow

Plant Detail load → check sessionStorage cache (60 min/plant) → miss: `POST /api/ai/suggest` with crop, days-since-planted/watered/fertilized, last diagnosis, current score → Gemini Text returns 1–2 plain sentences → cached + shown in the blue card. Not stored in DB (Phase 2 adds a `suggestions` table + weather context). **Never counted against scan credits.**

## 8. Harvest Passport Flow

"Mark as Harvested" → confirm → `POST /api/passports/generate`:
grow_days = harvest − plant_date · avg_health = mean(history) · ai_scan_count = count(ai_analyses) · fertilizer_summary = {types[], count} · badges: pesticide_free = no log has `metadata.pesticide_used=true`; organic = no fertilize log has `metadata.fertilizer_category='chemical'`; ai_verified = scans ≥1; Verified Grower read live from `profiles.is_verified` at render. `qr_token = randomUUID()` → insert passport + `harvested` log + set `lifecycle_status='harvested'`. Passport is a frozen snapshot — never recalculated.

## 9. How Data Moves (one example, end to end)

Grower taps "Log Water" → modal confirm → **client** inserts `growth_logs` (RLS allows: plant→farm→own) → client calls **`/api/health/recalculate`** → route (service role) fetches inputs, runs `calculate.ts`, updates `plants.health_score`, inserts history row, returns score → **UI** updates the ring; Farm Map shows it on next load; weeks later the passport's `avg_health` averages those snapshots; the consumer's QR page renders the same log in the public timeline via a service-role server fetch.

---

## 10. Important Files — Where to Change Things

| You want to change… | Edit |
|---|---|
| Health formula, weights, decay rates | `lib/health/calculate.ts` (one place — server + client share it) |
| Gemini prompts / validation / severity map | `lib/ai/gemini-vision.ts`, `gemini-text.ts`, `validate.ts` |
| Trust badge rules | `lib/passport/aggregate.ts` (+ migration if fields change) |
| Theme colors / fonts / radius | Tailwind config + CSS variables (tokens from `06`) |
| event_type / enums / table fields | `types/index.ts` + new SQL migration + `03_BACKEND_TRUTH.md` |
| Marker colours / bands / icons | `lib/health/display.ts` — `healthDisplay` (band colour, label, status icon, thresholds, D10); marker shape in `farm/PlantMarker.tsx`; summary in `farm/PlantBottomSheet.tsx` |
| Tab bar / navigation | `layout/AppShell.tsx`, `middleware.ts` |
| Demo data | `scripts/seed-demo.ts` |

When architecture changes, update `docs/03_BACKEND_TRUTH.md` and the Decision Log in `docs/00_BUILD_PLAN.md` in the same commit.

## 11. Debugging Common Issues

| Symptom | Likely cause | Fix |
|---|---|---|
| Query returns empty but data exists | RLS blocking (wrong user / missing policy) | Run query in SQL editor as that user; check policy chain farm→plant |
| Scan always fails | Gemini returned prose around JSON | Check `validate.ts` retry; log raw response server-side |
| Marker color ≠ detail score | One side using stored score, other live | Both must call `calculate.ts` on load |
| New plant shows red | Score being written at creation | Creation must NOT set/recalc score — NULL until first event (D4) |
| Trend chart flat/empty | History snapshot not written on save | Every `health_score` UPDATE must insert a history row |
| Badge wrong on passport | Log saved without `metadata` fields | LogModal must always write `fertilizer_category` / `pesticide_used` |
| QR page 500 | service-role key missing on Vercel / bad token handling | Check env; return friendly 404 on no-match |
| Timeline missing events | Non-canonical `event_type` string | Only the six enum values, exactly |

---

*GreenMap · Code Concept v1 · docs/01*
