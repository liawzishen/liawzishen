# 00 — GreenMap Build Plan
> Master build plan for the hackathon MVP · Created 13 Jun 2026
> Status: D1–D10 **APPROVED** · **Phases 1–8 build complete** · deploy + demo rehearsal remaining (see `docs/08_DEMO.md`).
> Build note (Phase 1): the Profile tab lives at `/farms/[farmId]/profile` (not `/profile`) so the tab bar keeps farm context; the minimal `/consumer` page and the Profile tab were built as working skeletons in Phase 1.

---

## 0. Decision Log

Every pending decision is tracked here. Items marked ⚠️ change parts of this plan if rejected.

| ID | Decision | Recommendation | Status |
|---|---|---|---|
| D1 | Visual theme | iOS-native **light** theme per `06` v2 + prototype. Dark mode = Phase 2 | ✅ Approved 13 Jun 2026 |
| D2 | Navigation structure | Adopt `06` 5-tab shell (Home / Map / Scan / Sales / Profile), staged — see §3 | ✅ Approved 13 Jun 2026 |
| D3 | API routes | 5 server routes (`scan`, `save-scan`, `suggest`, `health/recalculate`, `passports/generate`); Mapbox proxy = optional stretch | ✅ Approved 13 Jun 2026 |
| D4 | New plant marker | `plants.health_score` **nullable**; NULL until first scoring event → grey "New" ring | ✅ Approved 13 Jun 2026 |
| D5 | Plant status | Split into `manual_status` (healthy/attention/critical) + `lifecycle_status` (active/harvested) | ✅ Approved 13 Jun 2026 |
| D6 | Weather API | Phase 2 only (prompt input to Gemini Text, never in health formula) | ✅ Approved 13 Jun 2026 |
| D7 | Backend doc of record | `docs/03_BACKEND_TRUTH.md` is canonical; regenerate `05_Technical_Architecture.md` later if wanted | ✅ Approved 13 Jun 2026 |
| D8 | HTML prototype | `greenmap-interactive.html` is now in the project — tokens & tab bar verified identical to `06` | ✅ Approved 13 Jun 2026 |
| D9 | Plant marker visual | _(Superseded by D10.)_ **Minimalist redesign:** health score → lightness/saturation of a single green (deep+saturated ≈100, pale+washed ≈0); no number/glyph by default; tap reveals the score inside the circle, tap-again opens detail. Replaces the solid band-colour + white number + ✓/!/✕ glyph. Band colours (`display.ts`) still drive the Plant Detail page. | ✅ Approved 13 Jun 2026 |
| D10 | Plant marker + interaction | **Accessibility + UX revamp — supersedes D9.** High-contrast band colours (green/amber/red/grey) + an always-visible status icon, so status is never colour-only. A **single tap** opens a slide-up **bottom sheet** (name, exact score, status, quick actions Water/Fertilize/Note, and a _View More Details_ CTA) — no tap-to-reveal, no double-tap. Map state is a single `selectedPlant`; reusable `ui/BottomSheet`. | ✅ Approved 14 Jun 2026 |

---

## 1. MVP Scope (Must Build)

The hackathon build = the complete grower → consumer trust loop, nothing else.

**Features**
1. Landing page
2. Register / Login with role selection (grower / consumer)
3. Farm Selector (multi-farm, empty state)
4. Farm Setup wizard — 3 steps, write to DB only on Step 3
5. Farm Map (Konva canvas, 3-layer background, pan/zoom, plant markers with health rings)
6. Add plant (placement mode → modal → save, positions as 0–1 percentages)
7. Plant Detail (health score, status, trend chart, info, quick actions)
8. Log water / fertilizer / note (with structured `metadata` for badges)
9. AI Scan — Gemini Vision, grower reviews before save
10. AI Suggestion card — Gemini Text, session-cached (does NOT use scan credits)
11. Health score engine — deterministic 40/25/20/15 formula + `health_score_history` snapshots
12. Activity timeline (recent events inline + full pushed page)
13. Harvest Passport generation (server-side aggregate, trust badges, QR token)
14. Consumer QR View — fully public server component at `/passport/[qrToken]`
15. Seed script for demo data

**Screens (12 core, from `06` v2)**
Landing · Auth · Farm Selector · Setup 1–3 · Home Dashboard · Plant Detail · AI Scan · Activity Timeline · Harvest Passport · Consumer QR View
(+ thin helpers if D2 approved: full Map page, Scan plant-picker, minimal Profile, minimal Consumer home)

---

## 2. Future Scope (Do NOT Build Now)

| Phase 2 | Phase 3 |
|---|---|
| Weather-aware suggestions (Open-Meteo → Gemini prompt) | Marketplace (listings, orders, checkout, chat) |
| Stored suggestions + "Mark as done" | Payments (FPX / TnG — even simulated) |
| AI zone detection | GreenPoints economy + Missions UI |
| Dark mode, desktop layouts, BM i18n | Leaderboard + Grower Score |
| Farm editing after creation, mini-map | Reviews, ads, B2B data |
| Notifications engine | IoT, real-time, 3D scanning |
| Scan credit enforcement (5/month tiers) | Auto crop purchasing |

The 4 prototype PREVIEW screens (Sell This Harvest, My Sales, Marketplace, Alerts) are **static mockups only**, built in Phase 8 *only if time remains*. Scan credits are NOT enforced in MVP — hackathon phase is "everything free" per `04` §13.

---

## 3. Build Phases & Task Checklists

> Sequencing principle from the locked architecture: **grower flow end-to-end before polish.** Within Phase 4, build Plant Detail's basic layout before the full map — having plant rows in the DB makes map testing easier.

### Phase 1 — Foundation (project setup, theme, routing, auth shell)
- [x] `create-next-app` (TypeScript, App Router, Tailwind), deploy empty app to Vercel
- [x] Design tokens from `06` §5–7 → Tailwind config + CSS variables (colors, type scale, radius, spacing)
- [x] Folder structure per `docs/01_CODE_CONCEPT.md` §2
- [x] Supabase project + `lib/supabase/client.ts`, `server.ts`, `admin.ts`
- [x] `.env.local` with the 6 env vars (see `03_BACKEND_TRUTH.md` §8)
- [x] Route skeletons for all MVP pages; `AppShell` tab bar (D2) with placeholder tabs
- [x] Auth page: segmented Register/Login, role cards, `supabase.auth.signUp` with `{ name, role }` metadata
- [x] `middleware.ts` — redirect unauthenticated users to `/auth`; role-based post-login redirect
- **Exit test:** register → login → land on empty Farm Selector; logout works; protected route redirects.

### Phase 2 — Database (schema, RLS, storage, seed)
- [ ] `supabase/migrations/0001_init.sql` — all 8 tables per `03_BACKEND_TRUTH.md` (with D4/D5 amendments)
- [ ] Profile auto-create trigger on `auth.users` insert
- [ ] RLS policies (owner-scoped chain; public SELECT on `harvest_passports`)
- [ ] 3 public storage buckets: `farm-backgrounds`, `plant-scans`, `growth-photos`
- [ ] TypeScript types in `types/index.ts` mirroring the schema
- [ ] `scripts/seed-demo.ts` v1 (runs, inserts demo grower + farm + plants)
- **Exit test:** SQL runs clean; in SQL editor, user B cannot select user A's farms; seed data visible.

### Phase 3 — Public + entry pages
- [ ] Landing page (server component): hero, 3 value props, how-it-works, CTA
- [ ] Farm Selector: card grid + empty state + "Create New Farm"
- [ ] `FarmSetupContext` holding Steps 1–3 state
- [ ] Step 1 profile form (name, 16-state dropdown, size cards, crop chips) — Next disabled until valid
- [ ] Step 2 background selector (Smart default / Upload / Satellite) + 16:9 preview; upload → `farm-backgrounds`
- [ ] Step 3 zone chips (max 8, edit/delete) + batch save (farm insert → zones insert) → navigate to farm
- **Exit test:** create a farm end-to-end; refresh mid-wizard restarts cleanly; farm card appears in Selector.

### Phase 4 — Map & plants
- [ ] Plant Detail basic layout (name, score placeholder, info rows) — built FIRST
- [ ] Konva canvas: background layer (smart bg render / image), fixed aspect, fit-to-screen
- [x] Plant markers from DB — high-contrast band colour + always-visible status icon; single tap opens a bottom sheet (D10); grey when NULL per D4
- [ ] Pan (drag) + zoom (wheel / ± buttons) — cut first if time runs out
- [ ] Add-plant: + button → crosshair → tap → modal (name, type, zone optional, expected harvest date optional) → inserts plant + `planted` log
- [ ] Home Dashboard v1 (D2): KPI cards + map widget linking to full Map page
- **Exit test:** place plant → marker persists after reload → tap marker → Plant Detail opens.

### Phase 5 — Logs & health engine ✅
- [x] Log modals: Water (method) / Fertilizer (type, amount, category, pesticide) / Note (text, pesticide) → `growth_logs` insert with `metadata` — in the map bottom sheet + plant detail quick actions _(note photo upload deferred)_
- [x] `lib/health/calculate.ts` — pure shared function (no DB calls); unit-tested
- [x] `POST /api/health/recalculate` — fetch inputs, run formula, update `plants.health_score`, insert `health_score_history`
- [x] Manual status change UI → update + recalculate (`components/plant/ManualStatusControl.tsx`)
- [x] Passive decay: Plant Detail + Map compute live display score on load (`lib/health/live.ts`), never written
- [x] Health Trend chart — dependency-free inline SVG from `health_score_history` (7 days); Recharts not needed
- [x] Activity Timeline: recent inline on Plant Detail + full pushed page (`components/plant/ActivityTimeline.tsx`)
- **Exit test:** log water → score rises → new chart point → timeline entry; reload after 0 actions → display decays but DB value unchanged.

### Phase 6 — AI ✅
- [x] `lib/ai/gemini-vision.ts` + `gemini-text.ts` + `validate.ts` (REST, no SDK; JSON parse w/ 1 stricter retry, severity enum, confidence clamp, severity→sub-score map). `ai_sub_score` recomputed server-side — never trusted from client
- [x] `POST /api/ai/scan` — returns result only, never saves; neutral fallback on failure; **labelled mock when no `GEMINI_API_KEY`** so the flow is testable
- [x] AI Scan page + `ScanUploader`: pick photo (client-compress ≤1MB via canvas) → `plant-scans` → preview → loading → `AIScanResultCard`
- [x] `POST /api/ai/save-scan` (D3) — re-sanitise, insert `ai_analyses` + `growth_logs(ai_scan)`, recalculate + snapshot (shared `lib/health/recalculate.ts`)
- [x] "Save to Plant Record" / "Scan Again" buttons wired
- [x] `POST /api/ai/suggest` + blue `SuggestionCard` on Plant Detail, 60-min session cache (`sessionStorage`)
- **Exit test:** full scan→review→save updates score + timeline; malformed-JSON path shows friendly error; suggestion doesn't re-call API within 60 min.

### Phase 7 — Passport & QR ✅
- [x] `POST /api/passports/generate` (D3) — aggregates (grow_days, avg_health, ai_scan_count, fertilizer_summary), badge booleans, `qr_token`, inserts passport + `harvested` log + sets `lifecycle_status='harvested'`; idempotent. Pure aggregation in `lib/passport/aggregate.ts` (unit-tested)
- [x] "Mark as Harvested" confirm → call route → redirect to the public passport page
- [x] Passport card UI (certificate style) + earned-badges-only row + QR (via QR image service; swap to `react-qr-code` for offline)
- [x] WhatsApp share deep link _(download-as-image deferred)_
- [x] `/passport/[qrToken]` public server component — service-role fetch, certificate + trust badges + full growing story; friendly not-found
- **Exit test:** harvest a plant → scan QR with a logged-out phone → full story loads; wrong token → friendly 404.

### Phase 8 — Polish & demo (build ✅)
- [x] Loading skeletons (`app/loading.tsx` + passport), error boundary (`app/error.tsx`) + friendly 404 (`app/not-found.tsx`); empty states across pages
- [x] Home Dashboard v2: "Today's Tasks" accordion + batch actions + Completed Today tray (critical/attention/overdue-water/harvest-ready)
- [x] Harvest Ready stat (active + `expected_harvest_date` ≤ today)
- [ ] Optional (cut first): Sales/Profile preview screens with PREVIEW badge; Mapbox proxy route for live address search
- [ ] _Ops (your side):_ deploy + env vars on Vercel; demo rehearsal ×2; backup screenshots — runbook in `docs/08_DEMO.md`
- **Exit test:** 3-minute demo script runs start-to-finish on a phone with no dead ends.

---

## 4. Week Mapping (4 weeks)

| Week | Phases | Milestone |
|---|---|---|
| 1 | Phase 1 + Phase 2 (+ landing) | Register → login → empty Farm Selector; schema + RLS live |
| 2 | Phase 3 + Phase 4 | Create farm, place plants, see markers, open Plant Detail |
| 3 | Phase 5 + Phase 6 | Logging moves the score; AI scan loop complete |
| 4 | Phase 7 + Phase 8 | Passport + public QR; demo bulletproof |

**Cut order if behind** (from locked risk doc): 1) pan/zoom → static canvas, 2) trend chart → number only, 3) timeline photos → text only, 4) uploaded background → Smart only, 5) preview screens, 6) Mapbox live search. The core path **farm → plant → scan → harvest → QR** is never cut.

---

## 5. File-by-File Implementation Plan

Routes assume D2 approved (lean fallback: drop `map/`, `scan/` picker, `sales/`, `profile/`, render full map at `/farms/[farmId]`).

```
app/
  page.tsx                              Landing (server)            Phase 3
  auth/page.tsx                         Register/Login              Phase 1
  consumer/page.tsx                     Minimal consumer home       Phase 1 ✅ skeleton
  farms/page.tsx                        Farm Selector               Phase 3
  farms/new/profile|map|zones/page.tsx  Setup wizard                Phase 3
  farms/[farmId]/page.tsx               Home dashboard (tab)        Phase 4/8
  farms/[farmId]/map/page.tsx           Full farm map (tab)         Phase 4
  farms/[farmId]/scan/page.tsx          Plant picker (tab)          Phase 6
  farms/[farmId]/sales/page.tsx         PREVIEW static (tab)        Phase 8 optional
  farms/[farmId]/profile/page.tsx       Profile (tab)               Phase 1 ✅ skeleton
  farms/[farmId]/plants/[plantId]/page.tsx       Plant Detail       Phase 4/5
  farms/[farmId]/plants/[plantId]/scan/page.tsx  AI Scan            Phase 6
  farms/[farmId]/plants/[plantId]/activity/page.tsx  Timeline       Phase 5
  farms/[farmId]/plants/[plantId]/harvest/page.tsx   Passport       Phase 7
  passport/[qrToken]/page.tsx           Public QR view (server)     Phase 7
  api/ai/scan/route.ts · api/ai/save-scan/route.ts · api/ai/suggest/route.ts
  api/health/recalculate/route.ts · api/passports/generate/route.ts
  api/mapbox/satellite/route.ts         optional stretch            Phase 8

components/
  layout/AppShell.tsx (tab bar) · layout/TopNav.tsx (back header)
  ui/Button · Card · Badge · Input · Modal · SegmentedControl · EmptyState
  farm/FarmMap.tsx · PlantMarker.tsx · MapControls.tsx · AddPlantModal.tsx
  farm/FarmCard.tsx · KpiCards.tsx · PriorityList.tsx · ZoneChips.tsx
  plant/HealthScoreCard.tsx · HealthTrendChart.tsx · ActivityTimeline.tsx
  plant/QuickActions.tsx · LogModal.tsx · SuggestionCard.tsx
  ai/ScanUploader.tsx · AIScanResultCard.tsx
  passport/HarvestPassportCard.tsx · TrustBadges.tsx · QrBlock.tsx

lib/supabase/{client,server,admin}.ts · lib/ai/{gemini-vision,gemini-text,validate}.ts
lib/health/calculate.ts · lib/passport/aggregate.ts · lib/utils.ts
contexts/farm-setup-context.tsx · types/index.ts
supabase/migrations/0001_init.sql · scripts/seed-demo.ts · public/demo/
```

---

## 6. Testing Plan

Per-phase exit tests above, plus cross-cutting checks before demo week:

1. **RLS** — second test account cannot read/write the demo account's farms, plants, logs (SQL editor + UI).
2. **AI failure paths** — malformed Gemini JSON → retry → fallback object; oversize image rejected with message; scan with no photo blocked.
3. **Enum guard** — grep codebase: only the six canonical `event_type` strings appear.
4. **Decay math** — spot-check table: 3 days no water = sub-score 70; never watered = 0; new plant = NULL score, grey ring (D4).
5. **Public QR** — logged-out incognito phone loads `/passport/[token]`; invalid token shows friendly not-found; no other data reachable.
6. **Consistency** — Map marker % equals Plant Detail display score (same shared `calculate.ts`).
7. **Mobile** — every page at 393px; tap targets ≥44px; Lighthouse mobile pass on Landing + QR view.

---

## 7. Demo Preparation Plan

**Seed data (`scripts/seed-demo.ts`)** — grower *Ahmad* / farm *Ladang Hijau* (Johor, Tomato), pre-captured satellite background asset in `public/demo/`, ~30 plants with spread positions and varied scores (mostly healthy, 2 attention, 1 critical, 1 harvest-ready), backdated water/fertilize logs, 7 days of `health_score_history` for "Tomato A" (≈92%), 2–3 saved `ai_analyses`, and **one pre-harvested plant with a fixed `qr_token`** so the QR code can be printed in advance.

**Demo script (≤3 min, from `01` §14):** Landing → login as Ahmad → Home/Map with markers + stats → Tomato A detail (score, trend, suggestion, timeline) → AI scan with pre-tested leaf photo → save → score updates → Mark as Harvested → Passport + QR → phone scans QR → consumer story + badges → WhatsApp share.

**Fallbacks:** pre-tested photos only on stage; cached last successful scan result; static satellite asset (zero Mapbox dependency); full screenshot deck of every screen; charged phone + hotspot backup. Run the demo-day checklist from the architecture risk doc.

---

*GreenMap · Build Plan v1 · docs/00 · pending decisions D1–D8*
