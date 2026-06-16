# 08 — Demo Runbook
> Phase 8 · how to set up, run, and present GreenMap in ~3 minutes.

## One-time setup
1. `npm install`
2. Fill `.env.local`: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_APP_URL`. `GEMINI_API_KEY` is
   optional — **without it, AI scans return a clearly-labelled sample** so the
   flow still demos end-to-end.
3. Supabase → Authentication → **disable "Confirm email"** (so register logs in
   immediately).
4. Run the 4 SQL files in `supabase/migrations/` in order (SQL Editor).
5. `npm run db:seed` → grower **ahmad@greenmap.demo / Demo1234!**.
6. _(Optional, for a task-heavy screen)_ run `scripts/test-tasks-data.sql`.
7. `npm run dev` → http://localhost:3000

## Right before presenting
- Log in as Ahmad on the demo device.
- Pre-run one good leaf photo through **AI Scan** (so a clean result is cached).
- Pre-harvest one plant and keep its **/passport/[token]** open / printed for the
  consumer scan.
- Charged phone + hotspot backup; keep a **screenshot deck** of every screen.

## The 3-minute script
1. **Login** as Ahmad.
2. **Home** — Today's Tasks: show the accordions; tap **Water All** to clear a
   batch in one tap; point out Quick Stats + Recent Activity.
3. **Map tab** — your farms → open one → KPI strip + bird's-eye map; tap a
   marker → bottom sheet → **View More Details**.
4. **Plant Detail** — health score, 7-day trend, **Set Status**, activity (tap a
   scan → image + AI recommendations).
5. **AI Scan** — upload a leaf → diagnosis → **Save** → score + timeline update.
6. **Harvest** — Mark as Harvested → **Passport** generates with a QR.
7. **Consumer view** — scan the QR on a second, **logged-out** phone → the public
   passport: trust badges + the full growing story. (The trust loop closes.)

## Fallbacks
- No Gemini key → scan shows a labelled sample; the save/score/timeline flow is
  unaffected.
- Flaky network → use the pre-opened passport URL + the screenshot deck.
- Map slow to load → it cover-fits automatically; pan/zoom is optional.

## Deploy (Vercel)
- Import the repo → add the same env vars in Project Settings → deploy.
- Set `NEXT_PUBLIC_APP_URL` to the deployed URL so QR links resolve publicly.
- Smoke test: register → create a farm → confirm a logged-out
  `/passport/[token]` loads.

---
*GreenMap · Demo Runbook · docs/08*
