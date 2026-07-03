# Plan Payments & Listing Boosts — Design

**Date:** 2026-07-03
**Status:** Approved direction (user delegated final review to the built result)
**Source of business rules:** `skills-updated/greenmap-business-strategist/references/confirmed-decisions.md` (§1 AI Scan Tiers, §6 Payment System, §7 Advertising)

## Goal

Add the two farmer-payment features from the confirmed business model to the built app:

1. **Pay for our plan** — AI Scan subscription tiers with real credit enforcement.
2. **Pay for advertisement** — Promoted listing boosts on the marketplace.

Both use a **fully built payment UI with simulated transactions** (the design doc's MVP rule): FPX + Touch 'n Go checkout, records saved with `status: 'simulated'`, one server route as the future real-gateway swap point.

## Decisions made with the user (2026-07-03)

| Decision | Choice |
|---|---|
| Payment realism | Simulated checkout (no real gateway; no signup needed) |
| Credit enforcement | Real — scan API blocks at 0 credits |
| Ad substrate | Boosts sit on the existing mock marketplace listings |
| Demo arc | Demo account starts on Percuma with 2 of 5 credits left; judges see scan → hit limit → upgrade → scan again |
| Boost packages | RM 5 / 3 days · RM 10 / 7 days · RM 15 / 14 days |
| Architecture | Thin billing layer (Approach A) |

## Out of scope (unchanged phases)

- Consumer checkout / orders / escrow (Phase 3 marketplace)
- GreenPoints economy, leaderboard
- Real payment gateways (Revenue Monster / Stripe Malaysia) — production only
- Banner ads and sponsored badges (B2B deals, no in-app payment)

## Backend

### Migration `greenmap/supabase/migrations/0005_billing.sql`

- `profiles` + `plan text not null default 'percuma' check (plan in ('percuma','asas','pro','unlimited'))`, `bonus_scans integer not null default 0`, `plan_renews_at timestamptz` (display only).
- `ai_scan_usage (id, user_id → profiles, created_at)` — one row per consumed scan. Needed because `/api/ai/scan` analyses **without saving** (grower confirms before `/api/ai/save-scan` persists); counting saved `ai_analyses` would make unsaved analyses free and unlimited. Usage this month = count of rows in the current calendar month — nothing to reset, no cron.
- `payments (id, user_id, kind check in ('plan','topup','boost'), amount_rm numeric(8,2), method check in ('fpx','tng'), status text default 'simulated', meta jsonb, created_at)`.
- `listing_boosts (id, user_id, listing_id text, package check in ('3d','7d','14d'), price_rm, starts_at, expires_at, created_at)` — `listing_id` is the mock marketplace id (e.g. `l1`). A listing is Promoted while a row with `expires_at > now()` exists.
- RLS — **read-only for clients; every billing write goes through server routes using the service-role client** (else a user could set their own `plan` or insert a free boost via the REST API):
  - `ai_scan_usage`, `payments` — select own rows only (`user_id = auth.uid()`); no insert/update/delete policies for `authenticated`.
  - `listing_boosts` — select for all authenticated users (every shopper sees the Promoted tag); no client write policies.
  - `profiles` — column-level protection: revoke broad `update` from `authenticated`, re-grant `update (name)` (the only column client code updates — `ProfileClient`). `plan`, `bonus_scans`, `plan_renews_at` change only via service role in `/api/payments`.
- Idempotent (`if not exists` guards) like 0001–0004. Indexes: `ai_scan_usage (user_id, created_at desc)`, `listing_boosts (listing_id, expires_at desc)`, `payments (user_id, created_at desc)`.

### Tier + price constants — `greenmap/lib/billing/plans.ts`

Single source of truth used by API routes and UI:

| Tier | Malay | Scans/month | RM/month |
|---|---|---|---|
| `percuma` | Percuma | 5 | 0 |
| `asas` | Asas | 20 | 6.90 |
| `pro` | Petani Pro | 60 | 19.90 |
| `unlimited` | Tanpa Had | ∞ | 39.90 |

Top-up: RM 1.50/scan (qty 1–10). Boosts: `3d` RM 5, `7d` RM 10, `14d` RM 15.

### Allowance helper — `greenmap/lib/billing/usage.ts`

`getScanAllowance(supabase, userId)` → `{ plan, limit, usedThisMonth, bonus, remaining, resetsOn }`. Two parallel queries: profile (plan, bonus_scans, plan_renews_at) + count of `ai_scan_usage` rows since the 1st of the current month. `remaining = max(0, limit - used) + bonus` (unlimited ⇒ `Infinity`). Consumption order: monthly allowance first, then `bonus_scans`.

### Enforcement — `/api/ai/scan` (modified)

After auth, before fetching the image / calling Gemini: compute allowance; if `remaining === 0` return **402** `{ error: "No scan credits left", code: "out_of_credits", resetsOn }`. On a **successful** analysis (parsed result or mock result): insert one `ai_scan_usage` row and decrement `bonus_scans` if the monthly allowance was already exhausted — both via the admin (service-role) client, matching `save-scan`'s existing pattern, since clients have no write access to billing tables. Failure fallbacks (`fallbackResult`) consume nothing. Mock mode (no `GEMINI_API_KEY`) **does** consume, so the paywall arc works without a key. Response also carries `remaining` so the UI can update the chip. Known small race: two concurrent scans can both pass the check — acceptable at demo scale, noted here deliberately.

### Payments — `/api/payments` (new, POST)

The single place money "moves"; body never contains an amount — the server derives price from constants and applies all effects with the service-role client:

- `{ kind: 'plan', tier, method }` → validates `tier` is a paid tier ≠ current → updates `profiles.plan`, sets `plan_renews_at = now() + 30 days` → payment row.
- `{ kind: 'topup', qty (1–10), method }` → `bonus_scans += qty`, amount = qty × 1.50 → payment row.
- `{ kind: 'boost', listingId, package, method }` → 409 if an active boost exists for that listing → inserts `listing_boosts` with `expires_at = now() + package days` → payment row.

Downgrades (including cancel to Percuma) are free: `{ kind: 'plan', tier: lower }` with `amount_rm = 0`, no checkout sheet — a confirm dialog updates the plan directly. Errors: 401 unauthenticated, 400 invalid tier/package/qty, 409 duplicate boost.

## Farmer-facing UX

### My Plan page — `greenmap/app/farms/[farmId]/plan/page.tsx` (+ `loading.tsx`)

Pushed page (outside the `(tabs)` group, back button like plant pages). Sections top to bottom:

1. Current plan card — tier name + Malay name, usage meter "🔬 3 of 5 scans used · resets 1 Aug", bonus credits if any.
2. Four tier cards — price, scans/month, one-line pitch; current tier marked; others show **Upgrade** (or **Switch** for downgrades).
3. Top-up card — RM 1.50/scan with − / + stepper (1–10), total shown, **Top up** button.
4. Payment history — list of payments (kind label, amount, method, date, small "Simulated" badge). Empty state if none.

Entry point: a "My Plan" row on the Profile tab (`(tabs)/profile`) between the comcard and the details list — shows tier + remaining at a glance, links to the plan page.

### Checkout sheet — `greenmap/components/billing/CheckoutSheet.tsx`

One reusable client component on the existing `BottomSheet`. Steps: order summary → method picker (FPX bank list: Maybank2u, CIMB Clicks, Public Bank, Bank Islam; or Touch 'n Go eWallet) → **Pay RM X** → ~2 s simulated processing spinner → success tick → `router.refresh()`. Footer on every state: *"🔒 Demo mode — transactions are simulated. Gateway integration ready for production."* POSTs `/api/payments` when the user taps Pay.

### Paywall arc (scan surfaces)

- Scan tab picker (`(tabs)/scan`) and plant scan page get a credits chip: "🔬 2 of 5 scans left this month" (links to plan page). Unlimited shows "Tanpa Had".
- Plant scan page server component fetches allowance; at `remaining === 0` it renders a paywall card **instead of** `ScanUploader`: "You've used all N scans this month" + **Upgrade plan** / **Top up scans** buttons → plan page (`?from=` return link back to the scan).
- `ScanUploader` also handles a mid-flight 402 (race case): swaps to the same paywall message.

### Boost flow (Sales tab + Marketplace)

- `SalesDashboard` "Active Listings" rows get ids matching `demo-listings.ts` and a **⚡ Boost** button; if actively boosted, show "⚡ Promoted · 5d left" instead. (Add any dashboard listing missing from `demo-listings.ts` to it so ids line up.)
- Boost button → package picker sheet (3 packages) → CheckoutSheet.
- `sales/page.tsx` and `sales/market/page.tsx` (server) fetch active boosts and pass them down. Marketplace sorts boosted listings first (stable within groups) and shows an **"⚡ Promoted"** chip on the card image; `ListingDetail` shows the same chip.

## Demo seeding

`greenmap/scripts/seed-demo.ts` gains an idempotent billing block scoped to the demo account only: set `plan = 'percuma'`, delete that account's `ai_scan_usage` rows for the current month, insert exactly 3 → demo starts at "2 of 5 left". Safe to re-run; never touches other accounts. (Consistent with the standing rule: never reseed real user data.)

## Testing & verification

- **Smoke test** (`greenmap/scripts/smoke-test.mjs`): stage 2 additionally probes the three new tables and, if missing (PostgREST 404/42P01), prints: run `supabase/migrations/0005_billing.sql` in the Supabase dashboard SQL editor (no CLI on this machine). Stage 3 (`--app`) additionally asserts the plan page renders the tier name and credits.
- **Manual arc (run before delivery):** scan with credits → chip decrements; exhaust credits → 402 paywall; upgrade to Asas via simulated FPX → scan succeeds; top-up +2 → bonus shown; boost `l1` (7 days) → Marketplace shows it first with Promoted chip; payment history shows all three payments; `npm run build` passes.
- No unit-test framework exists in the repo; smoke + manual arc is the standard here.

## Delivery

- New branch `payments-and-boosts` stacked on `worktree-optimize-transitions` (PR #1 is unmerged and moved the tab pages this feature attaches to). Draft PR with base `worktree-optimize-transitions`; it auto-retargets to `main` when PR #1 merges.
- One manual step for the user: paste `0005_billing.sql` into the Supabase SQL editor, then `npm run db:seed` for the demo billing state.

## Risks / consciously accepted

- Check-then-insert race on scan credits (one extra scan at worst; demo scale).
- Boosts reference mock listing ids — throwaway by design; real marketplace tables replace `listing_id text` with a FK in Phase 3.
- Monthly window is the calendar month for all tiers; `plan_renews_at` is cosmetic. Simplification of "30-day cycles", stated on the plan page as "resets on the 1st".
