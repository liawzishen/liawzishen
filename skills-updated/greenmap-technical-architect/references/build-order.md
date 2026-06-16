# GreenMap Build Order — 4 Weeks

> Historical plan — **all four weeks are complete** (Phases 1–8 shipped); kept for context. Two things shipped differently: the trend chart is a dependency-free **inline SVG** (not Recharts), and the **Map tab is a farms list** that opens the Konva canvas at `…/field`.

Core principle: **Build the grower flow end-to-end first.** A working farm → plant → scan → harvest → passport flow is worth more than 11 beautiful pages with no data flowing through them.

## Week 1 — Foundation

**Goal:** Auth works, database exists, landing page looks good.

| Day | Task | Output |
|---|---|---|
| 1–2 | Next.js project init, Tailwind, Supabase project creation | Repo deploys to Vercel |
| 2–3 | All 8 Supabase tables + RLS policies + TypeScript types | Tables tested in dashboard |
| 3–4 | Supabase Auth setup, registration with role selection, login | Users can register and log in |
| 4–5 | Next.js middleware for protected routes | Unauthenticated users redirect to /auth |
| 5–6 | Landing page (server component) | Hero, value props, CTA |
| 7 | Full auth flow test end-to-end | Register → login → /farms works |

**Milestone:** User can register, log in, and land on empty Farm Selector.

## Week 2 — Farm Core

**Goal:** Farm exists with plants visible on a map.

Build Plant Detail BEFORE Farm Map — having plant data in DB makes map testing easier.

| Day | Task | Output |
|---|---|---|
| 8 | Farm Selector page (empty state + card grid) | "Create Farm" or farm list |
| 9 | Farm Setup Step 1 (profile form) | Form data captured in Context |
| 10 | Farm Setup Step 2 (background selection + preview) | Smart Background works |
| 10 | Farm Setup Step 3 (zones + batch save to Supabase) | All data persists |
| 11 | Upload background option | Storage upload, URL saved |
| 11 | Plant Detail page (basic layout) | Plant info, health display |
| 12 | Quick actions: log water, fertilizer, note | Growth logs written |
| 12 | Health score recalculation API route | Score updates on actions |
| 13 | Farm Map canvas — static Konva + background | Background renders |
| 13 | Plant markers on canvas (read from DB) | Markers with health rings |
| 14 | Add plant mode (+ → click → modal → save) | New plants on map |

**Milestone:** Grower can create farm, add plants, log activities, see health update.

## Week 3 — Plant Intelligence

**Goal:** AI scan works, health trend visible, timeline shows history.

| Day | Task | Output |
|---|---|---|
| 15 | AI scan API route (Gemini Vision) | Returns diagnosis JSON |
| 16 | AI Scan page UI (upload, loading, result display) | Full scan experience |
| 17 | Save scan result flow (grower confirms) | Writes ai_analyses + growth_logs |
| 17 | AI suggestion API route (Gemini Text) | Suggestion on Plant Detail |
| 18 | Activity timeline component | All events chronologically |
| 19 | Health trend chart (inline SVG from health_score_history) | 7-day chart works |
| 20 | Pan and zoom on Farm Map (if time) | Konva stage dragging |
| 21 | Full grower flow test: farm → plant → water → scan → timeline | End-to-end works |

**Milestone:** Complete intelligence loop — AI scan updates health, timeline shows history.

## Week 4 — Transparency Layer + Demo

**Goal:** Harvest Passport works, QR page is public, demo is bulletproof.

| Day | Task | Output |
|---|---|---|
| 22 | "Mark as Harvested" flow + passport calculation | Passport data saved |
| 22 | Harvest Passport page (card + badges + QR) | Beautiful passport |
| 23 | Consumer QR View (public server component) | Full story at /passport/[token] |
| 24 | Seed demo script (30 plants, logs, scans, 1 passport) | Demo data ready |
| 25 | Demo flow rehearsal on mobile | Every step works |
| 26–27 | Bug fixes, edge cases, polish | Loading states, errors handled |
| 28 | Final demo rehearsal with seed data | Ready for stage |

**Milestone:** Demo runs flawlessly. Under 3 minutes.

## Risk Buffer

If anything takes longer than expected, cut in this order:
1. Pan/zoom — static canvas is fine
2. Health trend chart — health number is enough
3. Photo attachments in timeline — text-only events work
4. Uploaded background — Smart Background is the default

Core path (farm → plant → scan → harvest → QR) must work. Everything else is polish.
