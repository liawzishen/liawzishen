# 🌿 GreenMap

AI-powered farm management and harvest transparency for Malaysian smallholder farmers.
Built for **Codex Community Hackathon KL 2026** ("AI for Malaysia").

Growers map their farm from a bird's-eye view, track every plant's health with AI scans,
and generate a **Harvest Passport** — a QR code consumers scan to see the full growing journey.

> 📚 Project docs live in [`docs/`](./docs) — start with `docs/00_BUILD_PLAN.md`.
> Backend source of truth: `docs/03_BACKEND_TRUTH.md`. Demo runbook: `docs/08_DEMO.md`.

---

## Build status

All eight build phases are **complete and type-clean** (`npx tsc --noEmit` → 0 errors).
What's left is ops only: Vercel deploy + demo rehearsal (see `docs/08_DEMO.md`).

| Phase | Scope | Status |
|---|---|---|
| 1 | Setup · theme · routing · shell · Supabase clients · auth | ✅ Done |
| 2 | Database schema · RLS · storage · seed | ✅ Done |
| 3 | Landing · farm selector · setup wizard | ✅ Done |
| 4 | Farm map (Konva) · plant markers · plant detail | ✅ Done |
| 5 | Growth logs · health-score engine · trend · timeline | ✅ Done |
| 6 | AI scan (Gemini Vision) · AI suggestion (Gemini Text) | ✅ Done |
| 7 | Harvest Passport · QR · public passport page | ✅ Done |
| 8 | Polish · Today's Tasks · loading/error states · demo prep | ✅ Done |

## Stack

Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · Supabase (Auth / Postgres / Storage) · Gemini (Vision + Text, via REST — no SDK).
Map canvas: **Konva** / `react-konva`. Design system: iOS-native light theme — every token lives in `app/globals.css`.

---

## Quick start

**Requirements:** Node 18.18+ (Node 20 LTS recommended) and a free [Supabase](https://supabase.com) account.

```bash
# 1. Install dependencies (includes konva + react-konva)
npm install

# 2. Create a Supabase project, then copy the env template
cp .env.example .env.local
```

**3. Fill `.env.local`** — see [Environment variables](#environment-variables) below. The two
`NEXT_PUBLIC_*` Supabase values are enough to boot; the rest unlock seeding, AI and passports.

**4. ⚠️ Hackathon setting — turn OFF email confirmation** so registering logs people straight in:
Supabase Dashboard → **Authentication → Sign In / Providers → Email → disable "Confirm email"**.
If you skip this, registration shows a "check your email" notice instead of logging in.

```bash
# 5. Run it
npm run dev
# → http://localhost:3000
```

## Environment variables

| Variable | Scope | Needed for |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | public | everything (boot) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | public | everything (boot) |
| `NEXT_PUBLIC_APP_URL` | public | absolute QR / passport links |
| `SUPABASE_SERVICE_ROLE_KEY` | **server only** | seed script + API routes (recalculate, save-scan, passports, tasks) |
| `GEMINI_API_KEY` | **server only** | live Gemini Vision/Text. **Absent → a clearly-labelled mock result**, so the scan flow still demos |
| `GEMINI_MODEL` | server only | optional model override (default `gemini-2.0-flash`) |
| `MAPBOX_ACCESS_TOKEN` | server only | optional stretch (live satellite search); demo uses a pre-captured asset |

Never commit `.env.local`; never expose the server-only keys in the browser.

## What works today (smoke test)

1. **Landing** (`/`) → **Get Started** → `/auth`.
2. **Auth** (`/auth`) shows the interactive **sunflower scene**: on desktop the cursor becomes a sun and the flower heads track it (heliotropism); on **Register** the sunflower grows as the password meets each rule (uppercase / lowercase / number / symbol); on **Sign In** repeated failed attempts wilt it (lockout after 3). Register as a **Grower** → `/farms`.
3. Logged out, visiting `/farms` redirects to `/auth` (middleware); logged in, `/auth` redirects you by role. A **Consumer** lands on `/consumer`.
4. **Create a farm** via the 3-step wizard (profile → background → zones) — it writes to the DB only on step 3, then opens the farm Home.
5. **Home** (`/farms/[farmId]`): greeting, **Quick Stats** tiles, and **Today's Tasks** — a grouped accordion (🧺 Ready to Harvest · 💧 Needs Watering · 🌿 Needs Fertilizer) with "Show more" expanders, **batch actions** (e.g. *Water All*), inline-completing cards, and a **✅ Completed Today** tray with undo. Recent activity below.
6. **Map tab** (`/farms/[farmId]/map`) is a **farms list**; tap a farm to open its **field** view (`/farms/[farmId]/field`) — the **Konva** bird's-eye canvas. Markers are high-contrast health bands (green / amber / red / grey "New") with an always-visible status; a single tap opens a bottom sheet; ＋ places a new plant (stored as 0–1 fractions).
7. **Plant Detail**: live health score (passive decay computed on load, never written), 7-day trend chart, a Gemini **suggestion card** (session-cached 60 min), and quick actions (Water / Fertilize / Note / manual Status) + activity timeline.
8. **AI Scan**: upload a leaf photo (client-compressed) → Gemini Vision result → **review** → *Save to Plant Record* (re-sanitised server-side, logs `ai_scan`, recalculates score + history snapshot).
9. **Harvest → Passport**: *Mark as Harvested* aggregates the journey, sets `lifecycle_status='harvested'`, mints a `qr_token`, and `/passport/[qrToken]` loads **fully public** (logged-out phone) — certificate, earned trust badges, full growing story, WhatsApp share.

## Project structure

```
app/
  page.tsx                              Landing (server)
  auth/page.tsx                         Register / Login + SunflowerScene
  consumer/page.tsx                     Minimal consumer home
  farms/page.tsx                        Farm selector (empty state + create)
  farms/new/{profile,map,zones}/        3-step setup wizard (saves on step 3)
  farms/[farmId]/page.tsx               Home (Quick Stats + Today's Tasks)
  farms/[farmId]/map/page.tsx           Map tab → farms LIST
  farms/[farmId]/field/page.tsx         KPI strip + Konva farm map
  farms/[farmId]/scan/page.tsx          Scan plant-picker tab
  farms/[farmId]/{sales,profile}/       Sales (preview) · Profile tabs
  farms/[farmId]/plants/[plantId]/{page,scan,activity,harvest}/
  passport/[qrToken]/page.tsx           Public QR view (server, service-role)
  loading.tsx · error.tsx · not-found.tsx
  api/ai/{scan,save-scan,suggest}/route.ts
  api/health/recalculate/route.ts · api/passports/generate/route.ts
  api/tasks/{complete,uncomplete}/route.ts

components/
  ai/ (ScanUploader, AIScanResultCard) · auth/ (SunflowerScene, PasswordChecklist, SignOutButton)
  dashboard/ · farm/ (FarmMap, FarmMapCanvas, PlantMarker, PlantBottomSheet, KpiStrip, …)
  home/ (TodaysTasks) · layout/ (AppShell, TopNav, StepDots)
  passport/ (HarvestPassportCard, TrustBadges, QrBlock, HarvestConfirm)
  plant/ (HealthTrendChart, ActivityTimeline, SuggestionCard, ManualStatusControl, …)
  ui/ (Button, Card, Badge, Input, Select, Modal/BottomSheet, SegmentedControl, EmptyState, Skeleton)

lib/  supabase/{client,server,admin,middleware} · ai/{gemini-vision,gemini-text,validate}
      health/{calculate,live,recalculate,display} · passport/aggregate · auth/password · utils
middleware.ts                            route protection + role-based redirects
types/  database.ts · index.ts
docs/   00_BUILD_PLAN · 01_CODE_CONCEPT · 02_PROTOTYPE_MAPPING · 03_BACKEND_TRUTH · 08_DEMO
supabase/migrations/  0001_init … 0004_storage
scripts/  seed-demo.ts · test-tasks-data.sql · README.md
```

## Conventions

- **Theme tokens live only in `app/globals.css`** (`@theme`). Never hardcode colours in components.
- Tab pages render `<AppShell>`; pushed sub-pages render `<TopNav>` — never both.
- Calculated values (health score, scan results, passports) are written **server-side only**, via the API routes — never trusted from the client.
- The health score is the deterministic **40/25/20/15** formula in `lib/health/calculate.ts` (one pure function shared by server writes and client display). Decay: watering −10/day, fertilizer −8/day; AI default 50; manual healthy/attention/critical = 100/50/0.
- `growth_logs.event_type` uses exactly six strings — `planted`, `water`, `fertilize`, `ai_scan`, `note`, `harvested` (see `docs/03_BACKEND_TRUTH.md` §3).

## Troubleshooting

- **"Missing Supabase env vars"** → copy `.env.example` to `.env.local`, fill both `NEXT_PUBLIC_*` values, restart `npm run dev`.
- **Register shows "check your email"** → email confirmation is still ON in Supabase (see Quick start step 4).
- **AI scan returns a "sample"/mock result** → no `GEMINI_API_KEY` set (expected). Add a free key from https://aistudio.google.com/apikey for live scans.
- **`npm install` version error on `@supabase/ssr`** → run `npm install @supabase/ssr@latest`.
- **Stuck in a redirect loop** → clear site cookies for `localhost:3000` and log in again.

## Deploy (Vercel)

Import the repo → add the same env vars in Project Settings (set `NEXT_PUBLIC_APP_URL` to the deployed URL so QR links resolve) → deploy. Middleware and the app frame work out of the box.

---

## Database setup (Phase 2)

The schema, RLS, storage and seed live in `supabase/` and `scripts/`.
Full instructions: **[`scripts/README.md`](./scripts/README.md)**. In short:

1. Run the 4 SQL files in `supabase/migrations/` in order (Supabase → SQL Editor).
2. Add `SUPABASE_SERVICE_ROLE_KEY` to `.env.local` (Settings → API → service_role).
3. `npm run db:seed` → demo grower `ahmad@greenmap.demo` / `Demo1234!`, farm *Ladang Hijau*, ~30 plants, backdated logs, a 7-day trend, saved AI analyses, and one harvested plant with a fixed passport at `/passport/00000000-0000-4000-8000-00000000d3m0`.

Need test rows for the Home **Today's Tasks** board? `scripts/test-tasks-data.sql` backdates a spread of overdue water / fertilizer / harvest-ready plants.
