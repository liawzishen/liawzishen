# Map Page Optimization — Desktop + Mobile + Daily Weather

**Date:** 2026-07-06
**Page:** `/farms/[farmId]/field` (the Map tab)
**Status:** Approved for implementation (autonomous session — decisions documented here for review)

## 1. Problems found (why optimize)

1. **Desktop is wasted.** The whole app renders inside a 430px phone frame
   (`app/layout.tsx`); on a laptop the map page is a phone screen centred in
   blank parchment. The layout comment itself says "full desktop layouts are
   Phase 2" — this spec delivers that for the map page.
2. **No environment data.** Farmers plan watering/fertilizing daily, but the
   app shows no temperature, rain, or soil-moisture information anywhere.
3. **No graphs on the map page.** The only chart in the app is the 7-day
   health trend on Plant Detail. The map page has no visual data at all.
4. **Needs-care plants are hard to enumerate.** The "Need Care" filter dims
   markers, but there is no list view; on desktop there is room to show one.
5. **KPI strip hides cards.** Five cards in a horizontal scroller is right on
   mobile, but on desktop they should all be visible at once.

## 2. Approaches considered

- **A. Separate desktop dashboard route** — rejected: duplicates the canvas,
  bottom-sheet and KPI logic; two sources of truth for one screen.
- **B. Make the existing field page responsive (chosen)** — one route, one
  data fetch; desktop breaks out of the phone frame using the same
  `.app-frame:has(...)` escape hatch the login page already uses, gated
  behind a `min-width: 1024px` media query so mobile is untouched.
- **C. Full sidebar dashboard (like `farm-map-dashboard.html` prototype)** —
  rejected: replaces the working tab navigation and risks demo stability;
  the right-hand info panel from that prototype is kept as inspiration.

## 3. Design

### 3.1 Weather integration (server-side, no new dependencies)

- **Provider: Open-Meteo** — free, no API key, no signup. Nothing to leak in
  the browser, nothing to expire on stage. Two endpoints:
  - Geocoding: `geocoding-api.open-meteo.com/v1/search?name={farm.location}`
    (farms store a free-text `location`, no coordinates). Cached 24 h via
    `next: { revalidate }`. Failure → default coordinates (Kuala Lumpur
    3.139, 101.687) so Malaysian demo farms still get sensible weather.
  - Forecast: daily `temperature_2m_max/min`, `precipitation_sum`,
    `precipitation_probability_max`, `weather_code`; hourly
    `soil_moisture_3_to_9cm` (root zone) averaged per day server-side.
    `past_days=2, forecast_days=7, timezone=auto`. Cached 30 min.
- **Demo reliability (architecture rule):** any fetch/parse failure returns a
  deterministic synthetic dataset shaped like a typical Malaysian week
  (24–33 °C, afternoon rain) tagged `source: "fallback"`; the UI shows a
  small "sample data" note. The page never breaks if Wi-Fi dies on stage.
- **Watering advisory** (`lib/weather/advice.ts`, pure function):
  - rain probability ≥ 60 % today → "Rain expected — skip watering"
  - soil moisture < 0.18 m³/m³ and max ≥ 33 °C → "Hot & dry — water morning and evening"
  - soil moisture < 0.18 → "Soil drying — water today"
  - otherwise → "Soil moisture good — no watering needed"
- Files: `lib/weather/fetch.ts` (server-only fetch + fallback),
  `lib/weather/advice.ts` (pure logic), types exported from `fetch.ts`.
- **Not** a new API route: the field page is a server component; it fetches
  weather directly in parallel with the farm bundle. Client JS unchanged.

### 3.2 Desktop layout (≥ 1024px)

Breakout marker `.map-breakout` on the page `<main>` +
`@media (min-width:1024px) { .app-frame:has(.map-breakout) { max-width:none; … } }`.

Two-column grid, max-width ~1400px centred:

- **Left (flexible):** farm switcher header → KPI row (all five cards in a
  grid, no scrolling) → the existing Konva map, taller
  (`lg:h-[calc(100dvh-230px)]`). All canvas interactions unchanged.
- **Right (~380px panel):** stacked cards —
  1. **Today card:** temp max/min, rain chance, soil moisture %, weather
     icon + the watering advisory banner (color-coded).
  2. **Temperature chart:** 9-day max/min lines (2 past + today + 6 ahead),
     dependency-free inline SVG in the style of `HealthTrendChart`.
  3. **Soil moisture & rain chart:** moisture line + rain-probability bars,
     same SVG approach with a "today" divider.
  4. **Needs care list:** plants with low/attention scores, each linking to
     its plant detail page.

### 3.3 Mobile layout (< 1024px) — additive only

Existing layout untouched (header → KPI strip → map). One addition: a
compact horizontally-scrollable **weather strip** between the KPI strip and
the map — 7 day-pills (weekday, weather emoji, max °C, moisture %) with the
one-line watering advisory above it. Charts remain desktop-only (the
user asked for "more information + graphs" on desktop specifically).

### 3.4 Components

| File | Kind | Purpose |
|---|---|---|
| `lib/weather/fetch.ts` | server lib | geocode + forecast + fallback |
| `lib/weather/advice.ts` | pure lib | watering advisory |
| `components/farm/WeatherToday.tsx` | server | today card + advisory |
| `components/farm/WeatherCharts.tsx` | server | 2 inline-SVG charts |
| `components/farm/WeatherStrip.tsx` | server | mobile day-pills + advisory line |
| `components/farm/NeedsCareList.tsx` | server | desktop care list |
| `(tabs)/field/page.tsx` | modified | parallel weather fetch, responsive grid |
| `components/farm/FarmMap.tsx` | modified | accepts `className` for height override |
| `components/farm/KpiStrip.tsx` | modified | `lg:` grid variant (mobile identical) |
| `app/globals.css` | modified | media-queried breakout rule |

### 3.5 Error handling

- Geocode/forecast failure, non-OK status, malformed JSON → fallback dataset
  (never `throw` from the page).
- Missing soil-moisture values (API returns nulls for some hours) → skip
  nulls in the daily mean; if a whole day is null, interpolate neighbours.
- Fewer than 2 chart points → charts render an empty-state box (same
  pattern as `HealthTrendChart`).

### 3.6 Testing / verification

Repo has no unit-test framework (smoke script only). Verification is via the
dev-server preview: desktop 1280px and mobile 375px snapshots, console and
network checks, plus `next build` type-check pass.

## 4. Out of scope

Marker dragging, zone polygons, IoT sensors, hourly forecasts, weather-based
health-score changes, push notifications, desktop layouts for other tabs.
