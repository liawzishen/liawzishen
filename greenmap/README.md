# 🌿 GreenMap

AI-powered farm management and harvest transparency for Malaysian smallholder farmers.

Growers map their farm from a bird's-eye view, track every plant's health with AI scans,
and generate a **Harvest Passport** — a QR code consumers scan to see the full growing journey.

> 📚 Project docs live in [`docs/`](./docs) — start with `docs/00_BUILD_PLAN.md`.
> Backend source of truth: `docs/03_BACKEND_TRUTH.md`. Demo runbook: `docs/08_DEMO.md`.

---

## Build status

All eight build phases are **complete and type-clean** (`npx tsc --noEmit` → 0 errors).

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

### Recent additions

- **Responsive Farm Map dashboard + live weather.** At ≥1024px the Map tab breaks out of the
  430px phone frame into a two-column dashboard: the Konva map and a full KPI grid on the left,
  a sticky weather panel (today's conditions, 9-day temperature chart, soil-moisture & rain
  chart) on the right, plus a farm health-trend chart, a needs-care list, and upcoming harvests
  underneath. Weather comes from **Open-Meteo** (free, keyless) — geocoded from the farm's state
  by default, or from an exact **GPS pin** captured during farm setup. Mobile keeps the original
  layout plus a compact day-pill weather strip. Weather requests are bounded by
  a timeout, so a slow or unreachable Open-Meteo falls back to sample data
  within a few seconds instead of stalling the page. See
  `../docs/superpowers/specs/2026-07-06-map-page-optimization-design.md`
  (design specs live one level up, outside the `greenmap/` app).
- **Home page daily briefing.** A one-line watering advisory (rain/heat/soil-moisture based)
  sits above Today's Tasks; task groups, the Completed Today tray, and Recent Activity now
  scroll inside their card instead of paginating with "Show more" buttons.
- **Rustic auth redesign.** `/auth` now uses a parchment/adventure-map visual language
  (`app/auth/layout.tsx`, `.auth-rustic` tokens in `globals.css`) with a landscape background
  and the interactive `SunflowerScene` (heliotropism, password-growth, wilt-on-lockout) — scoped
  to login/register only, the rest of the app stays on the Liquid Glass theme.
- **Billing & Marketplace preview.** Plan tiers, scan credits, listing boosts, and a simulated
  payment history (`lib/billing/`, `/farms/[farmId]/plan`, `/farms/[farmId]/sales/*`) — no real
  payment gateway; see `docs/00_BUILD_PLAN.md` §2 for what's intentionally still a static preview.
- **Marketplace ranking engine.** Listing order is decided by `lib/marketplace/rank.ts`: a
  capped **Promoted** tier (paid boosts, but never a wall of ads, and only if relevant/in stock)
  followed by a weighted organic score — popularity (log-damped), engagement (Bayesian-smoothed
  CTR + dwell), freshness, trust, proximity, health — with cold-start fairness for new listings.
  Each card shows a chip naming the signal it over-indexes on. Engagement numbers are simulated
  on the demo listings; the ranker itself is production-shaped.
- **Consumer (buyer) app.** `/consumer` is a full tabbed app (Home dashboard with GreenPoints +
  ranked "Fresh near you" · Market · Orders · Profile, plus a Scan FAB) mirroring the grower
  shell. Listing detail + simulated checkout live at `/consumer/listing/[id]`. Demo login:
  `siti@greenmap.demo` / `Demo1234!` (`npm run seed:consumer`).
- **Customer service, both sides.** Buyers get a per-order support hub (refund/return request,
  star feedback, seller chat, and an **AI admin assistant** — Gemini triages the issue but is
  deliberately powerless: refunds insert as `pending` only, with **no client update policy**, so
  the AI/customer can never self-approve). Growers get a **Customer Service inbox**
  (`/farms/[farmId]/support`) to approve/reject refunds, reply to customers, and read feedback —
  seller access is RLS keyed on farm ownership. Growers can also toggle listings
  **in/out of stock** (`listing_stock`); the market greys sold-out cards and drops them from
  promotion. Migrations `0007`/`0008`; demo data via `npm run seed:support`.

## Stack

Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · Supabase (Auth / Postgres / Storage) · Gemini (Vision + Text, via REST — no SDK) · Open-Meteo (weather, keyless REST).
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
`NEXT_PUBLIC_*` Supabase values are enough to boot; the rest unlock seeding, AI, satellite search and passports. Weather needs no key at all.

**4. ⚠️ Demo setting — turn OFF email confirmation** so registering logs people straight in:
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
| `SUPABASE_SERVICE_ROLE_KEY` | **server only** | seed scripts + API routes (recalculate, save-scan, passports, tasks) |
| `GEMINI_API_KEY` | **server only** | live Gemini Vision/Text. **Absent → a clearly-labelled mock result**, so the scan flow still demos |
| `GEMINI_MODEL` | server only | optional model override (default `gemini-2.0-flash`) |
| `MAPTILER_API_KEY` | **server only** | optional live satellite search in farm setup (`/api/satellite`). Without it, "Satellite" falls back to the smart background |

No key is needed for weather — the Map tab and Home advisory call the public Open-Meteo API directly from the server, and fall back to a labelled sample dataset if the network is unavailable.

Never commit `.env.local`; never expose the server-only keys in the browser.

## What works today (smoke test)

1. **Landing** (`/`) → **Get Started** → `/auth`.
2. **Auth** (`/auth`) is a parchment "adventure map" (rustic theme, `.auth-rustic`) with the interactive **sunflower scene**: on desktop the cursor becomes a sun and the flower heads track it (heliotropism); on **Register** the sunflower grows as the password meets each rule (uppercase / lowercase / number / symbol); on **Sign In** repeated failed attempts wilt it (lockout after 3). Register as a **Grower** → `/farms`.
3. Logged out, visiting `/farms` redirects to `/auth` (middleware); logged in, `/auth` redirects you by role. A **Consumer** lands on `/consumer`.
4. **Create a farm** via the 3-step wizard (profile → background → zones) — it writes to the DB only on step 3, then opens the farm Home. Step 1 has an optional **"Pin my farm's GPS location"** button (browser geolocation) so the Map tab's weather forecasts the exact field instead of the state capital.
5. **Home** (`/farms/[farmId]`): greeting, tappable **Quick Stats** tiles (link through to the Map tab), a one-line **watering advisory** (rain/heat/soil-moisture, from live weather), and **Today's Tasks** — a grouped accordion (🧺 Ready to Harvest · 💧 Needs Watering · 🌿 Needs Fertilizer) that scrolls inside each card past ~5 rows, **batch actions** (e.g. *Water All*), inline-completing cards, and a **✅ Completed Today** tray with undo. A scrollable **Recent Activity** feed (last 20 events) sits below.
6. **Map tab** (`/farms/[farmId]/field`, reached from the tab bar; the older `/farms/[farmId]/map` URL redirects here) is the **Konva** bird's-eye canvas. Markers are high-contrast health bands (green / amber / red / grey "New") with an always-visible status; a single tap opens a bottom sheet; ＋ places a new plant (stored as 0–1 fractions). **At ≥1024px** it becomes a two-column dashboard — full KPI grid + map on the left, a sticky weather panel (today's conditions, temperature chart, soil-moisture & rain chart) on the right, and a farm health-trend chart, needs-care list, and upcoming harvests underneath. **On mobile** a compact 7-day weather strip sits above the map.
7. **Plant Detail**: live health score (passive decay computed on load, never written), 7-day trend chart, a Gemini **suggestion card** (session-cached 60 min), and quick actions (Water / Fertilize / Note / manual Status) + activity timeline.
8. **AI Scan**: upload a leaf photo (client-compressed) → Gemini Vision result → **review** → *Save to Plant Record* (re-sanitised server-side, logs `ai_scan`, recalculates score + history snapshot).
9. **Harvest → Passport**: *Mark as Harvested* aggregates the journey, sets `lifecycle_status='harvested'`, mints a `qr_token`, and `/passport/[qrToken]` loads **fully public** (logged-out phone) — certificate, earned trust badges, full growing story, WhatsApp share.
10. **Sales (preview)**: plan tiers + scan credits (`/farms/[farmId]/plan`), a simulated marketplace and listing flow (`/farms/[farmId]/sales/*`) — no real payment gateway. Rankings are decided by the marketplace ranking engine; the grower can toggle their own listings **in/out of stock** and open the **Customer Service** inbox to approve/reject refunds, reply to customers, and read feedback.
11. **Consumer app**: log in as `siti@greenmap.demo` / `Demo1234!` → a tabbed buyer app (Home · Market · Orders · Profile + Scan FAB). Tap an order → support hub: request a refund/return (opens as `pending`; only the seller can approve), leave star feedback, message the seller, or ask the **AI admin assistant** (Gemini triage with a mock fallback).

## Project structure

```
app/
  page.tsx                              Landing (server)
  auth/{layout,page}.tsx                 Rustic parchment theme + Register/Login + SunflowerScene
  consumer/(tabs)/{page,market,orders,profile}/  Buyer app: Home dashboard · Market · Orders · Profile
  consumer/listing/[listingId]/page.tsx Listing detail + simulated checkout (consumer route)
  consumer/orders/[orderId]/page.tsx    Order detail + customer-service hub (refund/feedback/chats)
  consumer/support/[thread]/page.tsx    Support chat — seller thread or the AI admin assistant
  consumer/scan/page.tsx                Scan-a-passport page (links the sample QR)
  farm-dashboard/page.tsx               Standalone desktop dashboard mockup preview (not in the tab flow)
  farms/page.tsx                        Farm selector (empty state + create)
  farms/new/{profile,map,zones}/        3-step setup wizard (optional GPS pin on step 1; saves on step 3)
  farms/[farmId]/(tabs)/page.tsx        Home (Quick Stats + watering advisory + Today's Tasks + activity)
  farms/[farmId]/(tabs)/field/page.tsx  Map tab — Konva map; responsive dashboard at lg+ (weather, charts, care lists)
  farms/[farmId]/map/page.tsx           Legacy URL — redirects straight to .../field
  farms/[farmId]/(tabs)/scan/page.tsx   Scan plant-picker tab
  farms/[farmId]/(tabs)/{sales,profile}/  Sales (preview) · Profile tabs
  farms/[farmId]/support/page.tsx       Grower Customer Service inbox (refunds, replies, feedback)
  farms/[farmId]/plan/page.tsx          My Plan — tier, usage, top-up, payment history
  farms/[farmId]/sales/{market,new}/    Marketplace preview + list-harvest form
  farms/[farmId]/plants/[plantId]/{page,scan,activity,harvest}/
  passport/[qrToken]/page.tsx           Public QR view (server, service-role)
  loading.tsx · error.tsx · not-found.tsx
  api/ai/{scan,save-scan,suggest}/route.ts
  api/health/recalculate/route.ts · api/passports/generate/route.ts
  api/tasks/{complete,uncomplete}/route.ts
  api/payments/route.ts · api/satellite/route.ts · api/support/chat/route.ts

components/
  ai/ (ScanUploader, AIScanResultCard) · auth/ (SunflowerScene, PasswordChecklist, SignOutButton, map/{Landscape,TopoBackground,SceneProps})
  billing/ (PlanPageClient, BoostButton, CheckoutSheet) · sales/ (Marketplace, SalesDashboard, ListingDetail, ListHarvestForm)
  consumer/ (demo-consumer data, SupportChat, OrderSupport) · seller/ (RefundActions, SellerThread, StockToggle)
  dashboard/ (FarmDashboard — the standalone preview above)
  farm/ (FarmMap, FarmMapCanvas, PlantMarker, PlantBottomSheet, KpiStrip, AddPlantModal, FarmCard, FarmSwitcher, LogModal,
         WeatherToday, WeatherCharts, WeatherStrip, FarmHealthTrend, NeedsCareList, UpcomingHarvests)
  home/ (TodaysTasks) · layout/ (AppShell, ConsumerShell, TopNav, StepDots)
  passport/ (HarvestPassportCard, TrustBadges, QrBlock, HarvestConfirm)
  plant/ (HealthTrendChart, ActivityTimeline, SuggestionCard, ManualStatusControl, PlantQuickActions)
  ui/ (Button, Card, Badge, Input, Select, Modal/BottomSheet, SegmentedControl, EmptyState, Skeleton)

lib/  supabase/{client,server,admin,middleware} · ai/{gemini-vision,gemini-text,gemini-support,validate}
      health/{calculate,live,recalculate,display} · passport/aggregate · billing/{plans,usage}
      weather/{fetch,advice} · marketplace/rank · auth/password · farm/fetch · utils
middleware.ts                            route protection + role-based redirects
types/  database.ts · index.ts
docs/   00_BUILD_PLAN · 01_CODE_CONCEPT · 02_PROTOTYPE_MAPPING · 03_BACKEND_TRUTH · 08_DEMO
supabase/migrations/  0001_init … 0008_seller_support
# ../docs/superpowers/specs/ (repo root, one level up) — design specs for
# later features, e.g. the 2026-07-06 map-dashboard/weather spec
scripts/  seed-demo.ts · seed-billing.ts · seed-consumer.ts · seed-support.ts · smoke-test.mjs · test-tasks-data.sql · README.md
```

## Conventions

- **Theme tokens live only in `app/globals.css`** (`@theme`). Never hardcode colours in components.
  The rustic auth tokens are additive and only apply inside `.auth-rustic` — every other screen stays on the Liquid Glass tokens.
- Tab pages render `<AppShell>`; pushed sub-pages render `<TopNav>` — never both.
- Calculated values (health score, scan results, passports) are written **server-side only**, via the API routes — never trusted from the client.
- The health score is the deterministic **40/25/20/15** formula in `lib/health/calculate.ts` (one pure function shared by server writes and client display). Decay: watering −10/day, fertilizer −8/day; AI default 50; manual healthy/attention/critical = 100/50/0.
- `growth_logs.event_type` uses exactly six strings — `planted`, `water`, `fertilize`, `ai_scan`, `note`, `harvested` (see `docs/03_BACKEND_TRUTH.md` §3).
- Weather (`lib/weather/fetch.ts`) always degrades to a deterministic sample dataset on any network/parse failure — the Map tab and Home advisory must never break on stage. A farm's GPS pin (if set) beats geocoding its state name for forecast accuracy.
- The desktop Map dashboard escapes the mobile 430px app frame via `.map-breakout` in `globals.css` (`@media (min-width: 1024px)`) — the same escape-hatch pattern the auth breakout uses, just media-query-gated instead of unconditional.

## Troubleshooting

- **"Missing Supabase env vars"** → copy `.env.example` to `.env.local`, fill both `NEXT_PUBLIC_*` values, restart `npm run dev`.
- **Register shows "check your email"** → email confirmation is still ON in Supabase (see Quick start step 4).
- **AI scan returns a "sample"/mock result** → no `GEMINI_API_KEY` set (expected). Add a free key from https://aistudio.google.com/apikey for live scans.
- **Weather shows "sample data"** → Open-Meteo needs no key, so this means the request failed or the network is unavailable — it's the designed fallback, not a bug. Reload once you're back online.
- **Farm GPS pin doesn't save** → migration `0006_farm_coordinates.sql` hasn't been run yet (see Database setup below); the farm still saves fine without it, just without the exact-forecast pin.
- **`npm install` version error on `@supabase/ssr`** → run `npm install @supabase/ssr@latest`.
- **Stuck in a redirect loop** → clear site cookies for `localhost:3000` and log in again.

## Deploy (Vercel)

Import the repo → add the same env vars in Project Settings (set `NEXT_PUBLIC_APP_URL` to the deployed URL so QR links resolve) → deploy. Middleware and the app frame work out of the box.

---

## Database setup

The schema, RLS, storage and seed live in `supabase/` and `scripts/`.
Full instructions: **[`scripts/README.md`](./scripts/README.md)**. In short:

1. Run the 8 SQL files in `supabase/migrations/` in order (Supabase → SQL Editor).
2. Add `SUPABASE_SERVICE_ROLE_KEY` to `.env.local` (Settings → API → service_role).
3. `npm run db:seed` → demo grower `ahmad@greenmap.demo` / `Demo1234!`, farm *Ladang Hijau*, ~30 plants, backdated logs, a 7-day trend, saved AI analyses, and one harvested plant with a fixed passport at `/passport/00000000-0000-4000-8000-0000deadbeef`.

Need test rows for the Home **Today's Tasks** board? `scripts/test-tasks-data.sql` backdates a spread of overdue water / fertilizer / harvest-ready plants. Need billing state + a promoted listing? `npm run seed:billing`. Demo consumer login? `npm run seed:consumer`. A populated Customer Service inbox + an out-of-stock listing? `npm run seed:support`.
