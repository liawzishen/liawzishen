# Plan Payments & Listing Boosts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Farmers can pay (simulated FPX/TnG) for AI-scan subscription tiers with real credit enforcement, and pay to boost their marketplace listings ("Promoted" ads).

**Architecture:** Thin billing layer — `plan`/`bonus_scans` columns on `profiles`, three new read-only-for-clients tables (`ai_scan_usage`, `payments`, `listing_boosts`), usage derived by counting `ai_scan_usage` rows in the current UTC calendar month. One server route `/api/payments` derives all prices from constants and applies effects with the service-role client. One reusable `CheckoutSheet` powers upgrades, top-ups, and boosts.

**Tech Stack:** Next.js 15 App Router (RSC + client components), Supabase (@supabase/ssr session client + service-role admin client), Tailwind v4, TypeScript strict.

**Spec:** `docs/superpowers/specs/2026-07-03-payments-and-boosts-design.md`

## Global Constraints

- App lives in `greenmap/` under the repo root; all paths below are repo-root-relative. Branch: `payments-and-boosts` (already checked out, stacked on `worktree-optimize-transitions`).
- **No unit-test framework exists in this repo.** The verification ladder per task is `npx tsc --noEmit`; whole-feature verification is `npm run build` + the mock end-to-end arc (Task 10) + `scripts/smoke-test.mjs`.
- `greenmap/node_modules` does not exist in this worktree. Create a junction once (PowerShell, from the worktree root): `New-Item -ItemType Junction -Path "greenmap\node_modules" -Target "C:\Users\Dell\Documents\greenmap phas4\greenmap\node_modules"`. Remove it ONLY with `cmd /c rmdir "greenmap\node_modules"` (never `Remove-Item -Recurse` — it would delete the real files).
- Type checks run from `greenmap/`: `npx tsc --noEmit` (expect exit 0, no output).
- Tier names/prices are locked verbatim: Percuma RM 0 / 5 scans, Asas RM 6.90 / 20, Petani Pro RM 19.90 / 60, Tanpa Had RM 39.90 / unlimited. Top-up RM 1.50/scan (max 10). Boosts: 3d RM 5, 7d RM 10, 14d RM 15.
- Demo-mode footer copy, verbatim: `🔒 Demo mode — transactions are simulated. Gateway integration ready for production.`
- Clients NEVER send an amount; server derives every price from `lib/billing/plans.ts`.
- Every commit message ends with the two trailer lines used on this branch (`Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>` + `Claude-Session: https://claude.ai/code/session_01RbtSSujqhp7zyKiZz7rWqy`).
- Never run `npm run db:seed` against the current backend — it WIPES the demo grower's farms (`wipeFarms`). Demo billing state uses the new `npm run seed:billing` only.

---

### Task 1: Migration 0005 + billing constants

**Files:**
- Create: `greenmap/supabase/migrations/0005_billing.sql`
- Create: `greenmap/lib/billing/plans.ts`

**Interfaces:**
- Produces (for all later tasks): `PlanId`, `PLANS: Record<PlanId, PlanDef>`, `PLAN_ORDER: PlanId[]`, `isPlanId()`, `TOPUP_PRICE_RM = 1.5`, `TOPUP_MAX_QTY = 10`, `BoostPackageId`, `BOOST_PACKAGES: Record<BoostPackageId, BoostPackage>`, `isBoostPackageId()`, `formatRM(n): string`.
- DB: `profiles.plan/bonus_scans/plan_renews_at`; tables `ai_scan_usage`, `payments`, `listing_boosts` — clients read-only (RLS), service role writes.

- [ ] **Step 1: Ensure the node_modules junction exists** (skip if `greenmap/node_modules` already resolves)

Run (PowerShell, worktree root): `if (-not (Test-Path "greenmap\node_modules")) { New-Item -ItemType Junction -Path "greenmap\node_modules" -Target "C:\Users\Dell\Documents\greenmap phas4\greenmap\node_modules" }`

- [ ] **Step 2: Write the migration**

`greenmap/supabase/migrations/0005_billing.sql`:

```sql
-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║ GreenMap · 0005 · Billing: plan tiers, scan usage, payments, boosts   ║
-- ║ Spec: docs/superpowers/specs/2026-07-03-payments-and-boosts-design.md║
-- ║ Safe to re-run: IF NOT EXISTS + guarded constraints + drop-policy.   ║
-- ╚══════════════════════════════════════════════════════════════════════╝

-- ── profiles: plan + top-up credits (server-managed) ─────────────────────
alter table public.profiles
  add column if not exists plan text not null default 'percuma';
alter table public.profiles
  add column if not exists bonus_scans integer not null default 0;
alter table public.profiles
  add column if not exists plan_renews_at timestamptz;

do $$ begin
  alter table public.profiles
    add constraint profiles_plan_check
    check (plan in ('percuma', 'asas', 'pro', 'unlimited'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.profiles
    add constraint profiles_bonus_scans_check check (bonus_scans >= 0);
exception when duplicate_object then null; end $$;

-- Billing columns must not be self-servable through PostgREST: the only
-- client-side profiles write in the app is ProfileClient updating `name`.
revoke update on public.profiles from authenticated, anon;
grant update (name) on public.profiles to authenticated;

-- ── ai_scan_usage: one row per consumed AI scan ──────────────────────────
-- Usage this month = count of rows since the 1st (no counters, no cron).
create table if not exists public.ai_scan_usage (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists ai_scan_usage_user_created_idx
  on public.ai_scan_usage (user_id, created_at desc);

-- ── payments: every simulated transaction ────────────────────────────────
create table if not exists public.payments (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  kind       text not null check (kind in ('plan', 'topup', 'boost')),
  amount_rm  numeric(8,2) not null check (amount_rm >= 0),
  method     text not null check (method in ('fpx', 'tng')),
  status     text not null default 'simulated',
  meta       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists payments_user_created_idx
  on public.payments (user_id, created_at desc);

-- ── listing_boosts: promoted marketplace listings (ads) ──────────────────
-- listing_id is the mock marketplace id (components/sales/demo-listings.ts)
-- until the real marketplace tables land in Phase 3.
create table if not exists public.listing_boosts (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  listing_id text not null,
  package    text not null check (package in ('3d', '7d', '14d')),
  price_rm   numeric(8,2) not null,
  starts_at  timestamptz not null default now(),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists listing_boosts_listing_expires_idx
  on public.listing_boosts (listing_id, expires_at desc);

-- ── RLS: clients read; only the server (service role) writes ─────────────
alter table public.ai_scan_usage  enable row level security;
alter table public.payments       enable row level security;
alter table public.listing_boosts enable row level security;

drop policy if exists "scan_usage_select_own" on public.ai_scan_usage;
create policy "scan_usage_select_own" on public.ai_scan_usage
  for select using (auth.uid() = user_id);

drop policy if exists "payments_select_own" on public.payments;
create policy "payments_select_own" on public.payments
  for select using (auth.uid() = user_id);

-- Every signed-in shopper sees which listings are Promoted.
drop policy if exists "boosts_select_authenticated" on public.listing_boosts;
create policy "boosts_select_authenticated" on public.listing_boosts
  for select to authenticated using (true);

-- No insert/update/delete policies on any billing table: RLS denies by
-- default, so browsers cannot buy plans or boosts for free. All writes go
-- through /api/payments and /api/ai/scan using the service-role client.
```

- [ ] **Step 3: Write the constants module**

`greenmap/lib/billing/plans.ts`:

```ts
/**
 * Billing constants — the single source of truth for tiers and prices.
 * Server routes derive every charge from here; clients NEVER send amounts.
 * Business rules: AI Scan tiers §1, payment §6, promoted listings §7 of the
 * confirmed business model (see the 2026-07-03 payments spec).
 */

export type PlanId = "percuma" | "asas" | "pro" | "unlimited";

export type PlanDef = {
  id: PlanId;
  /** Malay-first display name (locked in the business model). */
  name: string;
  /** Short English descriptor shown under the name. */
  tagline: string;
  /** AI scans per calendar month; null = unlimited. */
  scansPerMonth: number | null;
  priceRM: number;
};

export const PLANS: Record<PlanId, PlanDef> = {
  percuma: {
    id: "percuma",
    name: "Percuma",
    tagline: "Free starter",
    scansPerMonth: 5,
    priceRM: 0,
  },
  asas: {
    id: "asas",
    name: "Asas",
    tagline: "Small farm basics",
    scansPerMonth: 20,
    priceRM: 6.9,
  },
  pro: {
    id: "pro",
    name: "Petani Pro",
    tagline: "Active farmer",
    scansPerMonth: 60,
    priceRM: 19.9,
  },
  unlimited: {
    id: "unlimited",
    name: "Tanpa Had",
    tagline: "Unlimited scanning",
    scansPerMonth: null,
    priceRM: 39.9,
  },
};

/** Cheapest → priciest; used to tell upgrades (charged) from downgrades (free). */
export const PLAN_ORDER: PlanId[] = ["percuma", "asas", "pro", "unlimited"];

export function isPlanId(v: unknown): v is PlanId {
  return typeof v === "string" && v in PLANS;
}

/** Top-up: extra scans without a subscription (no expiry). */
export const TOPUP_PRICE_RM = 1.5;
export const TOPUP_MAX_QTY = 10;

export type BoostPackageId = "3d" | "7d" | "14d";

export type BoostPackage = {
  id: BoostPackageId;
  days: number;
  priceRM: number;
  label: string;
};

export const BOOST_PACKAGES: Record<BoostPackageId, BoostPackage> = {
  "3d": { id: "3d", days: 3, priceRM: 5, label: "3 days" },
  "7d": { id: "7d", days: 7, priceRM: 10, label: "7 days" },
  "14d": { id: "14d", days: 14, priceRM: 15, label: "14 days" },
};

export function isBoostPackageId(v: unknown): v is BoostPackageId {
  return typeof v === "string" && v in BOOST_PACKAGES;
}

export function formatRM(amount: number): string {
  return `RM ${amount.toFixed(2)}`;
}
```

- [ ] **Step 4: Type-check**

Run (in `greenmap/`): `npx tsc --noEmit`
Expected: exit 0, no output.

- [ ] **Step 5: Commit**

```
git add greenmap/supabase/migrations/0005_billing.sql greenmap/lib/billing/plans.ts
git commit -m "Add billing migration 0005 and tier/price constants"
```

---

### Task 2: Scan allowance helper

**Files:**
- Create: `greenmap/lib/billing/usage.ts`

**Interfaces:**
- Consumes: `PLANS`, `isPlanId`, `PlanId` from `@/lib/billing/plans` (Task 1).
- Produces: `type ScanAllowance = { plan: PlanId; planName: string; limit: number | null; used: number; bonus: number; remaining: number | null; resetsOn: string; degraded?: boolean }`, `getScanAllowance(supabase: SupabaseClient, userId: string): Promise<ScanAllowance>`, `monthStartISO()`, `nextMonthStartISO()`. All fields JSON-serialisable (RSC → client props); `remaining === null` means unlimited (never block).

- [ ] **Step 1: Write the helper**

`greenmap/lib/billing/usage.ts`:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import { PLANS, isPlanId, type PlanId } from "./plans";

/**
 * Scan allowance for a user. Usage is DERIVED: a count of ai_scan_usage rows
 * in the current UTC calendar month — nothing to reset, no cron. Consumption
 * order is monthly allowance first, then purchased bonus scans, so
 * `remaining = max(0, limit - used) + bonus` (null = unlimited).
 *
 * If migration 0005 has not been applied yet, this degrades to a permissive
 * allowance (no enforcement) with `degraded: true` instead of crashing every
 * scan/profile page — the smoke test tells the user to run the migration.
 */
export type ScanAllowance = {
  plan: PlanId;
  planName: string;
  limit: number | null;
  used: number;
  bonus: number;
  remaining: number | null;
  resetsOn: string;
  degraded?: boolean;
};

export function monthStartISO(now = new Date()): string {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
  ).toISOString();
}

export function nextMonthStartISO(now = new Date()): string {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)
  ).toISOString();
}

let warnedDegraded = false;

export async function getScanAllowance(
  supabase: SupabaseClient,
  userId: string
): Promise<ScanAllowance> {
  const [profileRes, usageRes] = await Promise.all([
    supabase.from("profiles").select("plan, bonus_scans").eq("id", userId).single(),
    supabase
      .from("ai_scan_usage")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", monthStartISO()),
  ]);

  if (profileRes.error || usageRes.error) {
    if (!warnedDegraded) {
      warnedDegraded = true;
      console.warn(
        "⚠ GreenMap billing degraded — run supabase/migrations/0005_billing.sql " +
          "in the Supabase SQL editor. Scans are NOT being limited until then. " +
          `(${(profileRes.error ?? usageRes.error)?.message})`
      );
    }
    return {
      plan: "percuma",
      planName: PLANS.percuma.name,
      limit: null,
      used: 0,
      bonus: 0,
      remaining: null,
      resetsOn: nextMonthStartISO(),
      degraded: true,
    };
  }

  const plan: PlanId = isPlanId(profileRes.data?.plan) ? profileRes.data.plan : "percuma";
  const bonus = Math.max(0, profileRes.data?.bonus_scans ?? 0);
  const used = usageRes.count ?? 0;
  const limit = PLANS[plan].scansPerMonth;

  return {
    plan,
    planName: PLANS[plan].name,
    limit,
    used,
    bonus,
    remaining: limit === null ? null : Math.max(0, limit - used) + bonus,
    resetsOn: nextMonthStartISO(),
  };
}
```

- [ ] **Step 2: Type-check**

Run (in `greenmap/`): `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: Commit**

```
git add greenmap/lib/billing/usage.ts
git commit -m "Add getScanAllowance: derived monthly usage + bonus credits"
```

---

### Task 3: POST /api/payments

**Files:**
- Create: `greenmap/app/api/payments/route.ts`

**Interfaces:**
- Consumes: constants from Task 1; `createClient` (`@/lib/supabase/server`), `createAdminClient` (`@/lib/supabase/admin`), `getListing` (`@/components/sales/demo-listings`).
- Produces (HTTP contract used by CheckoutSheet/PlanPageClient):
  - Request: `{ kind: "plan", tier: PlanId, method: "fpx"|"tng" }` | `{ kind: "topup", qty: 1–10, method }` | `{ kind: "boost", listingId: string, package: BoostPackageId, method }`
  - 200: `{ ok: true, plan? , bonus?, boost?: { listingId, package, expiresAt } }`
  - Errors: 401 unauthenticated · 400 invalid body/tier/qty/package/same-plan · 404 unknown listing · 409 listing already boosted · 500 db error `{ error: string }`

- [ ] **Step 1: Write the route**

`greenmap/app/api/payments/route.ts`:

```ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  PLANS,
  PLAN_ORDER,
  isPlanId,
  TOPUP_PRICE_RM,
  TOPUP_MAX_QTY,
  BOOST_PACKAGES,
  isBoostPackageId,
  type PlanId,
} from "@/lib/billing/plans";
import { getListing } from "@/components/sales/demo-listings";

/**
 * POST /api/payments — the single place money "moves" (simulated).
 * The client says WHAT to buy, never the price: every amount is derived from
 * lib/billing/plans.ts. Effects are applied with the service-role client
 * because billing tables/columns are read-only for browsers (0005 RLS).
 * PRODUCTION SWAP POINT: replace the simulated success with a real gateway
 * call (Revenue Monster / Stripe Malaysia) and keep everything else.
 */

type Body = {
  kind?: string;
  method?: string;
  tier?: string;
  qty?: number;
  listingId?: string;
  package?: string;
};

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const method = body.method;
  if (method !== "fpx" && method !== "tng") {
    return NextResponse.json({ error: "method must be 'fpx' or 'tng'" }, { status: 400 });
  }

  const admin = createAdminClient();
  const record = async (
    kind: "plan" | "topup" | "boost",
    amountRM: number,
    meta: Record<string, unknown>
  ) => {
    const { error } = await admin.from("payments").insert({
      user_id: user.id,
      kind,
      amount_rm: amountRM,
      method,
      status: "simulated",
      meta,
    });
    if (error) throw new Error(`payment record failed: ${error.message}`);
  };

  try {
    // ── plan change (upgrades charge; downgrades are free) ────────────────
    if (body.kind === "plan") {
      if (!isPlanId(body.tier)) {
        return NextResponse.json({ error: "Unknown tier" }, { status: 400 });
      }
      const { data: profile, error: pErr } = await admin
        .from("profiles")
        .select("plan")
        .eq("id", user.id)
        .single();
      if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });

      const current: PlanId = isPlanId(profile?.plan) ? profile.plan : "percuma";
      if (current === body.tier) {
        return NextResponse.json({ error: "You are already on this plan" }, { status: 400 });
      }
      const isUpgrade = PLAN_ORDER.indexOf(body.tier) > PLAN_ORDER.indexOf(current);
      const amount = isUpgrade ? PLANS[body.tier].priceRM : 0;

      const { error: uErr } = await admin
        .from("profiles")
        .update({
          plan: body.tier,
          plan_renews_at:
            body.tier === "percuma"
              ? null
              : new Date(Date.now() + 30 * 86_400_000).toISOString(),
        })
        .eq("id", user.id);
      if (uErr) return NextResponse.json({ error: uErr.message }, { status: 500 });

      await record("plan", amount, { from: current, to: body.tier });
      return NextResponse.json({ ok: true, plan: body.tier });
    }

    // ── scan top-up ────────────────────────────────────────────────────────
    if (body.kind === "topup") {
      const qty = body.qty;
      if (!Number.isInteger(qty) || !qty || qty < 1 || qty > TOPUP_MAX_QTY) {
        return NextResponse.json(
          { error: `qty must be an integer between 1 and ${TOPUP_MAX_QTY}` },
          { status: 400 }
        );
      }
      const { data: profile, error: pErr } = await admin
        .from("profiles")
        .select("bonus_scans")
        .eq("id", user.id)
        .single();
      if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });

      const bonus = Math.max(0, profile?.bonus_scans ?? 0) + qty;
      const { error: uErr } = await admin
        .from("profiles")
        .update({ bonus_scans: bonus })
        .eq("id", user.id);
      if (uErr) return NextResponse.json({ error: uErr.message }, { status: 500 });

      await record("topup", qty * TOPUP_PRICE_RM, { qty });
      return NextResponse.json({ ok: true, bonus });
    }

    // ── listing boost (advertisement) ─────────────────────────────────────
    if (body.kind === "boost") {
      if (!body.listingId || !getListing(body.listingId)) {
        return NextResponse.json({ error: "Unknown listing" }, { status: 404 });
      }
      if (!isBoostPackageId(body.package)) {
        return NextResponse.json({ error: "Unknown boost package" }, { status: 400 });
      }
      const { data: active, error: bErr } = await admin
        .from("listing_boosts")
        .select("id")
        .eq("listing_id", body.listingId)
        .gt("expires_at", new Date().toISOString())
        .limit(1);
      if (bErr) return NextResponse.json({ error: bErr.message }, { status: 500 });
      if (active && active.length > 0) {
        return NextResponse.json(
          { error: "This listing is already promoted" },
          { status: 409 }
        );
      }

      const pkg = BOOST_PACKAGES[body.package];
      const expiresAt = new Date(Date.now() + pkg.days * 86_400_000).toISOString();
      const { error: iErr } = await admin.from("listing_boosts").insert({
        user_id: user.id,
        listing_id: body.listingId,
        package: pkg.id,
        price_rm: pkg.priceRM,
        expires_at: expiresAt,
      });
      if (iErr) return NextResponse.json({ error: iErr.message }, { status: 500 });

      await record("boost", pkg.priceRM, { listingId: body.listingId, package: pkg.id });
      return NextResponse.json({
        ok: true,
        boost: { listingId: body.listingId, package: pkg.id, expiresAt },
      });
    }

    return NextResponse.json({ error: "kind must be 'plan', 'topup' or 'boost'" }, { status: 400 });
  } catch (e) {
    console.error("[/api/payments]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Payment failed" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Type-check**

Run (in `greenmap/`): `npx tsc --noEmit` — expect exit 0.

- [ ] **Step 3: Commit**

```
git add greenmap/app/api/payments/route.ts
git commit -m "Add /api/payments: server-priced simulated plan/topup/boost"
```

---

### Task 4: Enforce scan credits in /api/ai/scan

**Files:**
- Modify: `greenmap/app/api/ai/scan/route.ts`

**Interfaces:**
- Consumes: `getScanAllowance`, `ScanAllowance` (Task 2); `createAdminClient`.
- Produces (HTTP contract used by ScanUploader, Task 7): 402 `{ error: "No scan credits left", code: "out_of_credits", resetsOn }` when blocked; success responses gain `scansLeft: number | null` (null = unlimited/degraded).

- [ ] **Step 1: Add imports and the consumption helper**

In `greenmap/app/api/ai/scan/route.ts`, extend the imports:

```ts
import { createAdminClient } from "@/lib/supabase/admin";
import { getScanAllowance, type ScanAllowance } from "@/lib/billing/usage";
```

Add below the imports:

```ts
/**
 * Record one consumed credit (service role — billing tables are read-only
 * for clients). Called ONLY on a successful analysis: failures cost nothing.
 * When the monthly allowance is exhausted the scan is funded by a purchased
 * bonus credit, so bonus_scans is decremented too. Accounting must never
 * break a scan that already succeeded — errors are logged, not thrown.
 */
async function consumeScanCredit(userId: string, allowance: ScanAllowance) {
  if (allowance.degraded) return; // 0005 not applied — nothing to write to
  try {
    const admin = createAdminClient();
    const { error } = await admin.from("ai_scan_usage").insert({ user_id: userId });
    if (error) throw error;
    if (
      allowance.limit !== null &&
      allowance.used >= allowance.limit &&
      allowance.bonus > 0
    ) {
      await admin
        .from("profiles")
        .update({ bonus_scans: allowance.bonus - 1 })
        .eq("id", userId);
    }
  } catch (e) {
    console.error("[/api/ai/scan] credit accounting failed:", e);
  }
}

const scansLeftAfter = (a: ScanAllowance) =>
  a.remaining === null ? null : Math.max(0, a.remaining - 1);
```

- [ ] **Step 2: Gate before Gemini, consume on success**

In `POST`, right after the `if (plantId) { … Plant not found … }` block and BEFORE the `GEMINI_API_KEY` check, insert:

```ts
  // Credit gate — checked before any Gemini/image cost (spec: enforce for real).
  const allowance = await getScanAllowance(supabase, user.id);
  if (allowance.remaining === 0) {
    return NextResponse.json(
      {
        error: "No scan credits left",
        code: "out_of_credits",
        resetsOn: allowance.resetsOn,
      },
      { status: 402 }
    );
  }
```

Change the mock branch (mock scans consume too, so the paywall arc works with no API key):

```ts
  if (!process.env.GEMINI_API_KEY) {
    await consumeScanCredit(user.id, allowance);
    return NextResponse.json({
      result: mockResult(cropType),
      scansLeft: scansLeftAfter(allowance),
    });
  }
```

Change the two successful-parse returns inside the Gemini `try`:

```ts
    try {
      const parsed = parseScanResult(raw);
      await consumeScanCredit(user.id, allowance);
      return NextResponse.json({ result: parsed, scansLeft: scansLeftAfter(allowance) });
    } catch {
      const retry = await geminiVision(
        { imageBase64, mimeType, cropType },
        { strict: true }
      );
      const parsed = parseScanResult(retry);
      await consumeScanCredit(user.id, allowance);
      return NextResponse.json({ result: parsed, scansLeft: scansLeftAfter(allowance) });
    }
```

Leave both `fallbackResult` returns unchanged except adding the unchanged balance, e.g. `return NextResponse.json({ result: fallbackResult("image"), scansLeft: allowance.remaining });` (same for the `"ai"` fallback) — failed analyses consume nothing.

Note: if the retry's `parseScanResult` throws, control falls to the outer `catch` and returns the `"ai"` fallback — same as today.

- [ ] **Step 3: Type-check**

Run (in `greenmap/`): `npx tsc --noEmit` — expect exit 0.

- [ ] **Step 4: Commit**

```
git add greenmap/app/api/ai/scan/route.ts
git commit -m "Enforce scan credits: 402 at zero, consume only on success"
```

---

### Task 5: CheckoutSheet (simulated FPX/TnG)

**Files:**
- Create: `greenmap/components/billing/CheckoutSheet.tsx`

**Interfaces:**
- Consumes: `BottomSheet` (`@/components/ui/BottomSheet`), `Button`, `formatRM`, `PlanId`, `BoostPackageId`; POSTs the Task 3 contract.
- Produces (used by Tasks 6 & 8):
  ```ts
  export type PaymentPayload =
    | { kind: "plan"; tier: PlanId }
    | { kind: "topup"; qty: number }
    | { kind: "boost"; listingId: string; package: BoostPackageId };
  export function CheckoutSheet(props: {
    open: boolean;
    onClose: () => void;
    title: string;               // e.g. "Upgrade to Petani Pro"
    amountRM: number;
    lines: Array<[string, string]>; // summary rows label → value
    payload: PaymentPayload;
  }): JSX.Element;
  ```
  On success it calls `router.refresh()` so server components re-read billing state.

- [ ] **Step 1: Write the component**

`greenmap/components/billing/CheckoutSheet.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import { formatRM, type BoostPackageId, type PlanId } from "@/lib/billing/plans";

/**
 * Simulated FPX / Touch 'n Go checkout used by plan upgrades, scan top-ups
 * and listing boosts. Mirrors the marketplace's mock checkout styling.
 * The sheet sends WHAT to buy — /api/payments derives the price server-side.
 */

export type PaymentPayload =
  | { kind: "plan"; tier: PlanId }
  | { kind: "topup"; qty: number }
  | { kind: "boost"; listingId: string; package: BoostPackageId };

const FPX_BANKS = ["Maybank2u", "CIMB Clicks", "Public Bank", "Bank Islam"];

type Phase = "method" | "processing" | "success" | "error";

export function CheckoutSheet({
  open,
  onClose,
  title,
  amountRM,
  lines,
  payload,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  amountRM: number;
  lines: Array<[string, string]>;
  payload: PaymentPayload;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("method");
  const [method, setMethod] = useState<"fpx" | "tng">("fpx");
  const [bank, setBank] = useState(FPX_BANKS[0]);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (open) {
      setPhase("method");
      setErrorMsg("");
    }
  }, [open]);

  async function pay() {
    setPhase("processing");
    // Simulated bank/eWallet handshake — the production gateway call
    // replaces this block (single swap point, see /api/payments).
    await new Promise((r) => setTimeout(r, 1800));
    try {
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, method }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Payment failed");
      setPhase("success");
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Payment failed");
      setPhase("error");
    }
  }

  function done() {
    onClose();
    router.refresh();
  }

  const close = phase === "processing" ? () => {} : phase === "success" ? done : onClose;

  return (
    <BottomSheet open={open} onClose={close} ariaLabel={title}>
      <h2 className="text-[18px] font-bold">{title}</h2>

      {phase === "method" && (
        <>
          <div className="mt-3 rounded-card bg-fill p-4 text-[14px]">
            {lines.map(([label, value]) => (
              <div key={label} className="flex items-center justify-between py-0.5">
                <span className="text-secondary">{label}</span>
                <span className="font-medium">{value}</span>
              </div>
            ))}
            <div className="mt-2 flex items-center justify-between border-t border-tertiary pt-2">
              <span className="font-semibold">Total</span>
              <span className="font-bold text-brand">{formatRM(amountRM)}</span>
            </div>
          </div>

          <p className="mt-4 text-[13px] font-semibold uppercase tracking-wide text-secondary">
            Payment method
          </p>
          <div className="mt-2 space-y-2">
            <MethodRow
              icon="🏦"
              title="FPX Online Banking"
              sub="Maybank, CIMB, Public Bank…"
              on={method === "fpx"}
              onClick={() => setMethod("fpx")}
            />
            {method === "fpx" && (
              <div className="flex flex-wrap gap-2 px-1">
                {FPX_BANKS.map((b) => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => setBank(b)}
                    className={`rounded-full px-3 py-1.5 text-[12px] font-semibold transition active:scale-95 ${
                      bank === b ? "bg-brand text-white" : "bg-fill text-label"
                    }`}
                  >
                    {b}
                  </button>
                ))}
              </div>
            )}
            <MethodRow
              icon="📱"
              title="Touch 'n Go eWallet"
              sub="Pay with your TnG balance"
              on={method === "tng"}
              onClick={() => setMethod("tng")}
            />
          </div>

          <Button full className="mt-5" onClick={pay}>
            Pay {formatRM(amountRM)}
          </Button>
        </>
      )}

      {phase === "processing" && (
        <div className="py-10 text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-[3px] border-fill border-t-brand" />
          <p className="mt-4 text-[15px] font-medium">
            {method === "fpx" ? `Connecting to ${bank}…` : "Opening Touch 'n Go…"}
          </p>
          <p className="mt-1 text-[13px] text-secondary">Do not close this screen.</p>
        </div>
      )}

      {phase === "success" && (
        <div className="py-8 text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-brand/15 text-[32px]">
            ✓
          </div>
          <h3 className="mt-4 text-[20px] font-bold">Payment successful</h3>
          <p className="mt-1 text-[14px] text-secondary">
            {formatRM(amountRM)} · {method === "fpx" ? `FPX (${bank})` : "Touch 'n Go"} · simulated
          </p>
          <Button full className="mt-6" onClick={done}>
            Done
          </Button>
        </div>
      )}

      {phase === "error" && (
        <div className="py-6 text-center">
          <p className="rounded-input bg-critical/10 p-3 text-[14px] text-critical">{errorMsg}</p>
          <div className="mt-4 flex gap-3">
            <Button variant="fill" full onClick={onClose}>
              Cancel
            </Button>
            <Button full onClick={() => setPhase("method")}>
              Try again
            </Button>
          </div>
        </div>
      )}

      <p className="mt-4 flex items-start gap-1.5 text-[12px] text-secondary">
        <span>🔒</span>
        <span>Demo mode — transactions are simulated. Gateway integration ready for production.</span>
      </p>
    </BottomSheet>
  );
}

function MethodRow({
  icon,
  title,
  sub,
  on,
  onClick,
}: {
  icon: string;
  title: string;
  sub: string;
  on: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-card p-3.5 text-left transition active:scale-[0.99] ${
        on ? "bg-brand/10 ring-2 ring-brand" : "bg-fill"
      }`}
    >
      <span className="text-[22px]">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold">{title}</span>
        <span className="block text-[12px] text-secondary">{sub}</span>
      </span>
      <span
        className={`grid h-5 w-5 place-items-center rounded-full border-2 ${
          on ? "border-brand bg-brand text-[11px] text-white" : "border-tertiary"
        }`}
      >
        {on ? "✓" : ""}
      </span>
    </button>
  );
}
```

- [ ] **Step 2: Type-check**

Run (in `greenmap/`): `npx tsc --noEmit` — expect exit 0.

- [ ] **Step 3: Commit**

```
git add greenmap/components/billing/CheckoutSheet.tsx
git commit -m "Add simulated FPX/TnG CheckoutSheet"
```

---

### Task 6: My Plan page + Profile entry row

**Files:**
- Create: `greenmap/app/farms/[farmId]/plan/page.tsx`
- Create: `greenmap/app/farms/[farmId]/plan/loading.tsx`
- Create: `greenmap/components/billing/PlanPageClient.tsx`
- Modify: `greenmap/app/farms/[farmId]/(tabs)/profile/page.tsx`
- Modify: `greenmap/components/profile/ProfileClient.tsx` (add `planSlot` prop)

**Interfaces:**
- Consumes: `getScanAllowance`/`ScanAllowance` (Task 2), constants (Task 1), `CheckoutSheet`/`PaymentPayload` (Task 5), `TopNav`, `Button`, `Badge`, `Skeleton`.
- Produces: route `/farms/[farmId]/plan`; `PlanPageClient({ farmId, allowance, payments })` with `export type PaymentRow = { id: string; kind: string; amount_rm: number; method: string; created_at: string; meta: Record<string, unknown> | null }`; `ProfileClient` gains optional `planSlot?: React.ReactNode` rendered under the comcard in view mode.

- [ ] **Step 1: Server page**

`greenmap/app/farms/[farmId]/plan/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TopNav } from "@/components/layout/TopNav";
import { getScanAllowance } from "@/lib/billing/usage";
import { PlanPageClient, type PaymentRow } from "@/components/billing/PlanPageClient";

/**
 * My Plan — current tier + usage, upgrade/downgrade, scan top-up, and the
 * simulated payment history. Pushed page reached from the Profile tab and
 * from the scan paywall.
 */
export default async function PlanPage({
  params,
}: {
  params: Promise<{ farmId: string }>;
}) {
  const { farmId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  const [allowance, paymentsRes] = await Promise.all([
    getScanAllowance(supabase, user.id),
    supabase
      .from("payments")
      .select("id, kind, amount_rm, method, created_at, meta")
      .order("created_at", { ascending: false })
      .limit(20),
  ]);
  const payments = (paymentsRes.data ?? []) as PaymentRow[];

  return (
    <main className="pb-12">
      <TopNav title="My Plan" backHref={`/farms/${farmId}/profile`} />
      <PlanPageClient farmId={farmId} allowance={allowance} payments={payments} />
    </main>
  );
}
```

`greenmap/app/farms/[farmId]/plan/loading.tsx`:

```tsx
import { Skeleton } from "@/components/ui/Skeleton";

export default function PlanLoading() {
  return (
    <main className="px-5 pb-12 pt-16">
      <Skeleton className="h-28 w-full rounded-card" />
      <div className="mt-4 space-y-3">
        <Skeleton className="h-20 w-full rounded-card" />
        <Skeleton className="h-20 w-full rounded-card" />
        <Skeleton className="h-20 w-full rounded-card" />
      </div>
    </main>
  );
}
```

(If `Skeleton`'s actual props differ, match the usage in `greenmap/app/farms/[farmId]/(tabs)/loading.tsx`.)

- [ ] **Step 2: PlanPageClient**

`greenmap/components/billing/PlanPageClient.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { CheckoutSheet, type PaymentPayload } from "@/components/billing/CheckoutSheet";
import {
  PLANS,
  PLAN_ORDER,
  TOPUP_PRICE_RM,
  TOPUP_MAX_QTY,
  formatRM,
  type PlanId,
} from "@/lib/billing/plans";
import type { ScanAllowance } from "@/lib/billing/usage";

export type PaymentRow = {
  id: string;
  kind: string;
  amount_rm: number;
  method: string;
  created_at: string;
  meta: Record<string, unknown> | null;
};

const KIND_LABEL: Record<string, string> = {
  plan: "Plan change",
  topup: "Scan top-up",
  boost: "Listing boost",
};

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "numeric" });

export function PlanPageClient({
  farmId,
  allowance,
  payments,
}: {
  farmId: string;
  allowance: ScanAllowance;
  payments: PaymentRow[];
}) {
  const router = useRouter();
  const [checkout, setCheckout] = useState<{
    title: string;
    amountRM: number;
    lines: Array<[string, string]>;
    payload: PaymentPayload;
  } | null>(null);
  const [qty, setQty] = useState(2);
  const [switching, setSwitching] = useState(false);

  const current = PLANS[allowance.plan];
  const total = (allowance.limit ?? 0) + allowance.bonus;
  const resetLabel = new Date(allowance.resetsOn).toLocaleDateString("en-MY", {
    day: "numeric",
    month: "short",
  });

  async function downgrade(tier: PlanId) {
    const name = PLANS[tier].name;
    if (!window.confirm(`Switch to ${name}? Downgrades are free and apply immediately.`)) return;
    setSwitching(true);
    try {
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "plan", tier, method: "fpx" }),
      });
      if (!res.ok) {
        const data = await res.json();
        window.alert(data?.error ?? "Could not switch plan");
      }
      router.refresh();
    } finally {
      setSwitching(false);
    }
  }

  return (
    <div className="px-5 pt-2">
      {allowance.degraded && (
        <p className="mb-4 rounded-input bg-warning/15 p-3 text-[13px] text-warning">
          Billing isn&apos;t set up on this backend yet — run{" "}
          <code>supabase/migrations/0005_billing.sql</code> in the Supabase SQL editor.
          Scans are not limited until then.
        </p>
      )}

      {/* ── Current plan ── */}
      <section className="rounded-card bg-card p-5 shadow-card">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-widest text-secondary">
              Current plan
            </p>
            <h1 className="mt-0.5 text-[24px] font-bold">{current.name}</h1>
            <p className="text-[13px] text-secondary">{current.tagline}</p>
          </div>
          <Badge tone="brand">{current.priceRM === 0 ? "Free" : `${formatRM(current.priceRM)}/mo`}</Badge>
        </div>

        {allowance.limit === null ? (
          <p className="mt-4 text-[14px] font-medium">🔬 Unlimited AI scans</p>
        ) : (
          <>
            <div className="mt-4 flex items-baseline justify-between text-[13px]">
              <span className="font-medium">
                🔬 {allowance.used} of {total} scans used
              </span>
              <span className="text-secondary">resets {resetLabel}</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-fill">
              <div
                className="h-full rounded-full bg-brand transition-[width]"
                style={{ width: `${Math.min(100, (allowance.used / Math.max(1, total)) * 100)}%` }}
              />
            </div>
            {allowance.bonus > 0 && (
              <p className="mt-2 text-[12px] text-secondary">
                includes {allowance.bonus} top-up scan{allowance.bonus === 1 ? "" : "s"}
              </p>
            )}
          </>
        )}
      </section>

      {/* ── Tiers ── */}
      <h2 className="mb-2 mt-7 text-[13px] font-semibold uppercase tracking-wide text-secondary">
        Plans
      </h2>
      <div className="space-y-3">
        {PLAN_ORDER.map((id) => {
          const p = PLANS[id];
          const isCurrent = id === allowance.plan;
          const isUpgrade = PLAN_ORDER.indexOf(id) > PLAN_ORDER.indexOf(allowance.plan);
          return (
            <div key={id} className="flex items-center gap-3 rounded-card bg-card p-4 shadow-card">
              <div className="min-w-0 flex-1">
                <p className="text-[16px] font-semibold">
                  {p.name}
                  <span className="ml-2 text-[13px] font-normal text-secondary">{p.tagline}</span>
                </p>
                <p className="mt-0.5 text-[13px] text-secondary">
                  {p.scansPerMonth === null ? "Unlimited scans" : `${p.scansPerMonth} scans/month`} ·{" "}
                  {p.priceRM === 0 ? "Free" : `${formatRM(p.priceRM)}/month`}
                </p>
              </div>
              {isCurrent ? (
                <Badge tone="neutral">Current</Badge>
              ) : isUpgrade ? (
                <Button
                  size="sm"
                  onClick={() =>
                    setCheckout({
                      title: `Upgrade to ${p.name}`,
                      amountRM: p.priceRM,
                      lines: [[`${p.name} · monthly`, formatRM(p.priceRM)]],
                      payload: { kind: "plan", tier: id },
                    })
                  }
                >
                  Upgrade
                </Button>
              ) : (
                <Button size="sm" variant="fill" disabled={switching} onClick={() => downgrade(id)}>
                  Switch
                </Button>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Top-up ── */}
      <h2 className="mb-2 mt-7 text-[13px] font-semibold uppercase tracking-wide text-secondary">
        Top-up scans
      </h2>
      <div className="rounded-card bg-card p-4 shadow-card">
        <p className="text-[14px]">
          Need a few more scans without upgrading? <b>{formatRM(TOPUP_PRICE_RM)}</b> per scan — they
          never expire.
        </p>
        <div className="mt-3 flex items-center gap-4">
          <div className="flex items-center gap-3 rounded-full bg-fill px-2 py-1">
            <button
              type="button"
              aria-label="Fewer scans"
              onClick={() => setQty((q) => Math.max(1, q - 1))}
              className="grid h-8 w-8 place-items-center rounded-full text-[18px] font-bold active:bg-card"
            >
              −
            </button>
            <span className="w-6 text-center text-[16px] font-bold">{qty}</span>
            <button
              type="button"
              aria-label="More scans"
              onClick={() => setQty((q) => Math.min(TOPUP_MAX_QTY, q + 1))}
              className="grid h-8 w-8 place-items-center rounded-full text-[18px] font-bold active:bg-card"
            >
              ＋
            </button>
          </div>
          <Button
            className="flex-1"
            onClick={() =>
              setCheckout({
                title: "Top up AI scans",
                amountRM: qty * TOPUP_PRICE_RM,
                lines: [[`${qty} scan${qty === 1 ? "" : "s"} × ${formatRM(TOPUP_PRICE_RM)}`, formatRM(qty * TOPUP_PRICE_RM)]],
                payload: { kind: "topup", qty },
              })
            }
          >
            Top up · {formatRM(qty * TOPUP_PRICE_RM)}
          </Button>
        </div>
      </div>

      {/* ── Payment history ── */}
      <h2 className="mb-2 mt-7 text-[13px] font-semibold uppercase tracking-wide text-secondary">
        Payment history
      </h2>
      <div className="overflow-hidden rounded-card bg-card shadow-card">
        {payments.length === 0 ? (
          <p className="p-4 text-[14px] text-secondary">No payments yet.</p>
        ) : (
          payments.map((pay, i) => (
            <div key={pay.id} className={`flex items-center gap-3 p-4 ${i > 0 ? "hairline-t" : ""}`}>
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-medium">{KIND_LABEL[pay.kind] ?? pay.kind}</p>
                <p className="text-[12px] text-secondary">
                  {fmtDate(pay.created_at)} · {pay.method === "tng" ? "Touch 'n Go" : "FPX"}
                </p>
              </div>
              <span className="text-[14px] font-semibold">{formatRM(Number(pay.amount_rm))}</span>
              <Badge tone="neutral">Simulated</Badge>
            </div>
          ))
        )}
      </div>

      <p className="mt-4 flex items-start gap-1.5 text-[12px] text-secondary">
        <span>🔒</span>
        <span>Demo mode — transactions are simulated. Gateway integration ready for production.</span>
      </p>

      {checkout && (
        <CheckoutSheet
          open
          onClose={() => setCheckout(null)}
          title={checkout.title}
          amountRM={checkout.amountRM}
          lines={checkout.lines}
          payload={checkout.payload}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 3: ProfileClient `planSlot`**

In `greenmap/components/profile/ProfileClient.tsx`: add to `Props`:

```ts
  /** Optional card rendered under the comcard in view mode (e.g. My Plan row). */
  planSlot?: React.ReactNode;
```

Then directly AFTER the closing `</section>` of the comcard (before the `{success && …}` block) insert:

```tsx
      {!editing && props.planSlot}
```

- [ ] **Step 4: Profile page passes the row**

Replace `greenmap/app/farms/[farmId]/(tabs)/profile/page.tsx` content with:

```tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProfileClient } from "@/components/profile/ProfileClient";
import { getScanAllowance } from "@/lib/billing/usage";

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ farmId: string }>;
}) {
  const { farmId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  const meta = (user.user_metadata ?? {}) as {
    name?: string;
    role?: string;
    headline?: string;
    avatar_url?: string;
  };

  // profiles mirrors name + holds the Verified Grower flag.
  const [{ data: profile }, allowance] = await Promise.all([
    supabase.from("profiles").select("name, is_verified").eq("id", user.id).maybeSingle(),
    getScanAllowance(supabase, user.id),
  ]);
  const p = profile as { name: string; is_verified: boolean } | null;

  const name = (meta.name || p?.name || "").toString();
  const role = meta.role === "consumer" ? "consumer" : "grower";
  const scansLine =
    allowance.remaining === null
      ? "Unlimited scans"
      : `${allowance.remaining} scan${allowance.remaining === 1 ? "" : "s"} left`;

  return (
    <main className="px-5 pb-10 pt-12">
      <p className="text-[12px] font-semibold uppercase tracking-widest text-secondary">
        Account
      </p>
      <h1 className="mb-5 mt-1 text-[28px] font-bold leading-tight">Profile</h1>

      <ProfileClient
        userId={user.id}
        email={user.email ?? "—"}
        role={role}
        initialName={name}
        headline={(meta.headline ?? "").toString()}
        avatarUrl={meta.avatar_url ?? null}
        isVerified={p?.is_verified ?? false}
        memberSince={user.created_at}
        planSlot={
          <Link
            href={`/farms/${farmId}/plan`}
            className="mt-4 flex items-center justify-between gap-3 rounded-card bg-card p-4 shadow-card transition active:bg-fill"
          >
            <div className="min-w-0">
              <p className="text-[12px] font-semibold uppercase tracking-wide text-secondary">
                My Plan
              </p>
              <p className="mt-0.5 truncate text-[16px] font-semibold">
                {allowance.planName}
                <span className="ml-2 text-[13px] font-normal text-secondary">🔬 {scansLine}</span>
              </p>
            </div>
            <span aria-hidden className="text-[18px] text-tertiary">
              ›
            </span>
          </Link>
        }
      />
    </main>
  );
}
```

- [ ] **Step 5: Type-check**

Run (in `greenmap/`): `npx tsc --noEmit` — expect exit 0. (If `Skeleton` props mismatch, adapt the loading file to the component's real API.)

- [ ] **Step 6: Commit**

```
git add greenmap/app/farms/[farmId]/plan greenmap/components/billing/PlanPageClient.tsx greenmap/components/profile/ProfileClient.tsx "greenmap/app/farms/[farmId]/(tabs)/profile/page.tsx"
git commit -m "Add My Plan page (tiers, top-up, history) + profile entry row"
```

---

### Task 7: Scan surfaces — credits chip, paywall, 402 handling

**Files:**
- Modify: `greenmap/app/farms/[farmId]/(tabs)/scan/page.tsx`
- Modify: `greenmap/app/farms/[farmId]/plants/[plantId]/scan/page.tsx`
- Modify: `greenmap/components/ai/ScanUploader.tsx`

**Interfaces:**
- Consumes: `getScanAllowance` (Task 2); scan API 402 contract + `scansLeft` (Task 4).
- Produces: `ScanUploader` gains optional prop `scansLeft?: number | null` (null = unlimited; undefined = hide chip).

- [ ] **Step 1: Scan tab chip**

In `greenmap/app/farms/[farmId]/(tabs)/scan/page.tsx`:

Add imports:

```ts
import { createClient } from "@/lib/supabase/server";
import { getScanAllowance, type ScanAllowance } from "@/lib/billing/usage";
```

Replace the body start (`const { farmId } = await params; const bundle = await getFarmBundle(farmId); if (!bundle) notFound();`) with:

```ts
  const { farmId } = await params;
  const [bundle, allowance] = await Promise.all([
    getFarmBundle(farmId),
    (async (): Promise<ScanAllowance | null> => {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      return user ? getScanAllowance(supabase, user.id) : null;
    })(),
  ]);
  if (!bundle) notFound();
```

Directly after the `<p className="mt-1 …">Pick a plant…</p>` subtitle, add:

```tsx
      {allowance && (
        <Link
          href={`/farms/${farmId}/plan`}
          className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-card px-3.5 py-2 text-[13px] font-semibold shadow-card transition active:bg-fill"
        >
          🔬{" "}
          {allowance.remaining === null
            ? `${allowance.planName} — unlimited scans`
            : `${allowance.remaining} of ${(allowance.limit ?? 0) + allowance.bonus} scans left`}
          <span aria-hidden className="text-tertiary">›</span>
        </Link>
      )}
```

- [ ] **Step 2: Plant scan page paywall**

Replace `greenmap/app/farms/[farmId]/plants/[plantId]/scan/page.tsx` content with:

```tsx
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TopNav } from "@/components/layout/TopNav";
import { Button } from "@/components/ui/Button";
import { ScanUploader } from "@/components/ai/ScanUploader";
import { getScanAllowance } from "@/lib/billing/usage";
import { formatRM, TOPUP_PRICE_RM } from "@/lib/billing/plans";

export default async function PlantScanPage({
  params,
}: {
  params: Promise<{ farmId: string; plantId: string }>;
}) {
  const { farmId, plantId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: plant }, allowance] = await Promise.all([
    supabase.from("plants").select("name, type").eq("id", plantId).single(),
    user ? getScanAllowance(supabase, user.id) : Promise.resolve(null),
  ]);
  if (!plant) notFound();
  const p = plant as { name: string; type: string };

  const blocked = allowance !== null && allowance.remaining === 0;
  const resetLabel = allowance
    ? new Date(allowance.resetsOn).toLocaleDateString("en-MY", { day: "numeric", month: "short" })
    : "";

  return (
    <main className="pb-12">
      <TopNav title="AI Scan" backHref={`/farms/${farmId}/plants/${plantId}`} />
      <div className="px-6 pt-2">
        <h1 className="text-[24px] font-bold leading-tight">{p.name}</h1>
        <p className="mt-0.5 text-[14px] text-secondary">
          Snap a leaf for an instant Gemini health check.
        </p>
        <div className="mt-4">
          {blocked && allowance ? (
            <div className="rounded-card bg-card p-6 text-center shadow-card">
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-warning/15 text-[26px]">
                🔬
              </div>
              <h2 className="mt-3 text-[18px] font-bold">
                You&apos;ve used all {(allowance.limit ?? 0) + allowance.bonus} scans this month
              </h2>
              <p className="mt-1 text-[14px] leading-relaxed text-secondary">
                Upgrade your plan or top up to keep scanning. Your {allowance.planName} scans reset
                on {resetLabel}.
              </p>
              <div className="mt-5 space-y-3">
                <Button href={`/farms/${farmId}/plan`} full>
                  Upgrade plan
                </Button>
                <Button href={`/farms/${farmId}/plan`} variant="fill" full>
                  Top up · {formatRM(TOPUP_PRICE_RM)}/scan
                </Button>
              </div>
            </div>
          ) : (
            <ScanUploader
              plantId={plantId}
              farmId={farmId}
              cropType={p.type}
              scansLeft={allowance ? allowance.remaining : undefined}
            />
          )}
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 3: ScanUploader — chip + 402**

In `greenmap/components/ai/ScanUploader.tsx`:

1. Extend the props signature:

```tsx
export function ScanUploader({
  plantId,
  farmId,
  cropType,
  scansLeft,
}: {
  plantId: string;
  farmId: string;
  cropType: string;
  /** Scans left this month; null = unlimited; undefined = unknown (hide chip). */
  scansLeft?: number | null;
}) {
```

2. Add state next to the other `useState` calls:

```ts
  const [left, setLeft] = useState<number | null | undefined>(scansLeft);
  const [blocked, setBlocked] = useState(false);
```

3. In `scan()`, replace the response handling block

```ts
      const data = await res.json();
      if (!res.ok || !data?.result) throw new Error(data?.error ?? "Scan failed");
      setResult(data.result as ScanResult);
      setPhase("result");
```

with:

```ts
      const data = await res.json();
      if (res.status === 402) {
        setBlocked(true);
        setLeft(0);
        setPhase("preview");
        setError("No scan credits left this month.");
        return;
      }
      if (!res.ok || !data?.result) throw new Error(data?.error ?? "Scan failed");
      if (data.scansLeft !== undefined) setLeft(data.scansLeft);
      setResult(data.result as ScanResult);
      setPhase("result");
```

4. At the top of the returned JSX (just before the `{previewUrl ? …}` block), add the chip:

```tsx
      {left !== undefined && (
        <p className="mb-3 text-[13px] font-medium text-secondary">
          🔬 {left === null ? "Unlimited scans" : `${left} scan${left === 1 ? "" : "s"} left this month`}
        </p>
      )}
```

5. After the existing `{error && …}` paragraph, add:

```tsx
      {blocked && (
        <Button href={`/farms/${farmId}/plan`} full className="mt-3">
          Get more scans
        </Button>
      )}
```

- [ ] **Step 4: Type-check**

Run (in `greenmap/`): `npx tsc --noEmit` — expect exit 0.

- [ ] **Step 5: Commit**

```
git add "greenmap/app/farms/[farmId]/(tabs)/scan/page.tsx" "greenmap/app/farms/[farmId]/plants/[plantId]/scan/page.tsx" greenmap/components/ai/ScanUploader.tsx
git commit -m "Show scan credits and paywall; handle 402 in the uploader"
```

---

### Task 8: Boost flow — Sales tab, Marketplace, listing detail

**Files:**
- Create: `greenmap/components/billing/BoostButton.tsx`
- Modify: `greenmap/components/sales/SalesDashboard.tsx`
- Modify: `greenmap/app/farms/[farmId]/(tabs)/sales/page.tsx`
- Modify: `greenmap/components/sales/Marketplace.tsx`
- Modify: `greenmap/app/farms/[farmId]/sales/market/page.tsx`
- Modify: `greenmap/components/sales/ListingDetail.tsx`
- Modify: `greenmap/app/farms/[farmId]/sales/market/[listingId]/page.tsx`

**Interfaces:**
- Consumes: `BOOST_PACKAGES`, `formatRM` (Task 1), `CheckoutSheet` (Task 5), `BottomSheet`, `Badge`.
- Produces: `BoostButton({ listingId, listingName, activeUntil }: { listingId: string; listingName: string; activeUntil?: string | null })`; `SalesDashboard` gains prop `boosts?: Record<string, string>` (listingId → expires_at ISO); `Marketplace` gains `boostedIds?: string[]`; `ListingDetail` gains `promoted?: boolean`.

- [ ] **Step 1: BoostButton**

`greenmap/components/billing/BoostButton.tsx`:

```tsx
"use client";

import { useState } from "react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { CheckoutSheet } from "@/components/billing/CheckoutSheet";
import { BOOST_PACKAGES, formatRM, type BoostPackageId } from "@/lib/billing/plans";

/**
 * "⚡ Boost" on the farmer's own listing rows (Shopee-Ads equivalent).
 * Package picker → simulated checkout → the listing shows "Promoted" at the
 * top of the Marketplace until the boost expires.
 */
export function BoostButton({
  listingId,
  listingName,
  activeUntil,
}: {
  listingId: string;
  listingName: string;
  activeUntil?: string | null;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selected, setSelected] = useState<BoostPackageId | null>(null);

  const activeMs = activeUntil ? new Date(activeUntil).getTime() - Date.now() : 0;
  if (activeMs > 0) {
    const daysLeft = Math.max(1, Math.ceil(activeMs / 86_400_000));
    return (
      <span className="shrink-0 rounded-full bg-warning/15 px-3 py-1.5 text-[12px] font-semibold text-warning">
        ⚡ Promoted · {daysLeft}d left
      </span>
    );
  }

  const pkg = selected ? BOOST_PACKAGES[selected] : null;

  return (
    <>
      <button
        type="button"
        onClick={() => setPickerOpen(true)}
        className="shrink-0 rounded-full bg-warning/15 px-3.5 py-2 text-[13px] font-semibold text-warning transition active:scale-95"
      >
        ⚡ Boost
      </button>

      <BottomSheet
        open={pickerOpen && !selected}
        onClose={() => setPickerOpen(false)}
        ariaLabel={`Boost ${listingName}`}
      >
        <h2 className="text-[18px] font-bold">⚡ Boost this listing</h2>
        <p className="mt-1 text-[13px] text-secondary">
          <b>{listingName}</b> jumps to the top of the Marketplace with a Promoted tag.
        </p>
        <div className="mt-4 space-y-2">
          {Object.values(BOOST_PACKAGES).map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setSelected(p.id)}
              className="flex w-full items-center justify-between rounded-card bg-fill p-4 text-left transition active:scale-[0.99]"
            >
              <span>
                <span className="block text-[15px] font-semibold">{p.label}</span>
                <span className="block text-[12px] text-secondary">Top of Marketplace</span>
              </span>
              <span className="text-[16px] font-bold text-brand">{formatRM(p.priceRM)}</span>
            </button>
          ))}
        </div>
        <p className="mt-4 flex items-start gap-1.5 text-[12px] text-secondary">
          <span>🔒</span>
          <span>Demo mode — transactions are simulated. Gateway integration ready for production.</span>
        </p>
      </BottomSheet>

      {pkg && (
        <CheckoutSheet
          open
          onClose={() => {
            setSelected(null);
            setPickerOpen(false);
          }}
          title={`Boost "${listingName}"`}
          amountRM={pkg.priceRM}
          lines={[[`Promoted for ${pkg.label}`, formatRM(pkg.priceRM)]]}
          payload={{ kind: "boost", listingId, package: pkg.id }}
        />
      )}
    </>
  );
}
```

- [ ] **Step 2: SalesDashboard — ids + boost props**

In `greenmap/components/sales/SalesDashboard.tsx`:

1. Import: `import { BoostButton } from "@/components/billing/BoostButton";`
2. Give the mock listings their marketplace ids (they must match `demo-listings.ts`: l1 tomatoes, l2 chili, l3 pak choi):

```ts
const LISTINGS = [
  { id: "l1", emoji: "🍅", name: "Organic Cherry Tomatoes", meta: "18 kg left · RM 8/kg", expires: "Expires in 2 days", verified: true },
  { id: "l2", emoji: "🌶️", name: "Fresh Red Chili", meta: "5 kg left · RM 12/kg", expires: "Expires tomorrow", verified: true },
  { id: "l3", emoji: "🥬", name: "Pak Choi", meta: "30 bundles · RM 3/bundle", expires: "Listed today", verified: false },
];
```

3. Signature: `export function SalesDashboard({ farmId, boosts = {} }: { farmId: string; boosts?: Record<string, string> }) {`
4. In the Active Listings map: key rows by `l.id`, and after the `{l.verified && <Badge tone="brand">✓ Passport</Badge>}` add:

```tsx
            <BoostButton listingId={l.id} listingName={l.name} activeUntil={boosts[l.id] ?? null} />
```

- [ ] **Step 3: Sales tab page fetches own boosts**

Replace `greenmap/app/farms/[farmId]/(tabs)/sales/page.tsx` content with:

```tsx
import { createClient } from "@/lib/supabase/server";
import { SalesDashboard } from "@/components/sales/SalesDashboard";

/**
 * Sales tab — "My Sales" hub. Simulated marketplace preview; listing BOOSTS
 * are real records (listing_boosts) so Promoted state survives reloads.
 */
export default async function SalesPage({
  params,
}: {
  params: Promise<{ farmId: string }>;
}) {
  const { farmId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const boosts: Record<string, string> = {};
  if (user) {
    const { data } = await supabase
      .from("listing_boosts")
      .select("listing_id, expires_at")
      .eq("user_id", user.id)
      .gt("expires_at", new Date().toISOString());
    for (const b of data ?? []) {
      if (!boosts[b.listing_id] || boosts[b.listing_id] < b.expires_at) {
        boosts[b.listing_id] = b.expires_at;
      }
    }
  }

  return <SalesDashboard farmId={farmId} boosts={boosts} />;
}
```

- [ ] **Step 4: Marketplace — promoted sort + chip**

In `greenmap/components/sales/Marketplace.tsx`:

1. Signature: `export function Marketplace({ farmId, boostedIds = [] }: { farmId: string; boostedIds?: string[] }) {`
2. After the `listings` filter, add the promoted-first sort:

```ts
  const boosted = new Set(boostedIds);
  const sorted = [...listings].sort(
    (a, b) => Number(boosted.has(b.id)) - Number(boosted.has(a.id))
  );
```

3. Map over `sorted` instead of `listings` (the empty state keeps using `listings.length`).
4. Inside the card image `div` (the one with `className="relative h-32"`), after the `✓ Passport Verified` span, add:

```tsx
              {boosted.has(l.id) && (
                <span className="absolute bottom-3 left-3 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-warning">
                  ⚡ Promoted
                </span>
              )}
```

- [ ] **Step 5: Marketplace page fetches all active boosts**

Replace the body of `greenmap/app/farms/[farmId]/sales/market/page.tsx` with:

```tsx
import { createClient } from "@/lib/supabase/server";
import { TopNav } from "@/components/layout/TopNav";
import { Marketplace } from "@/components/sales/Marketplace";

/**
 * Sales · Marketplace (simulated buyer browse). Listings are mock data;
 * PROMOTED state is real (listing_boosts) and visible to every shopper.
 */
export default async function MarketplacePage({
  params,
}: {
  params: Promise<{ farmId: string }>;
}) {
  const { farmId } = await params;

  const supabase = await createClient();
  const { data } = await supabase
    .from("listing_boosts")
    .select("listing_id")
    .gt("expires_at", new Date().toISOString());
  const boostedIds = [...new Set((data ?? []).map((b) => b.listing_id as string))];

  return (
    <main className="pb-12">
      <TopNav title="Marketplace" backHref={`/farms/${farmId}/sales`} />
      <Marketplace farmId={farmId} boostedIds={boostedIds} />
    </main>
  );
}
```

- [ ] **Step 6: Listing detail — Promoted badge**

1. `greenmap/components/sales/ListingDetail.tsx`: add `promoted?: boolean` to the props type and destructure it. In the DETAIL stage JSX (the default `stage === "detail"` render, below the payment/done stages), find the badges row that maps `listing.badges` (same pattern as Marketplace: a flex-wrap of pills). Prepend inside that container:

```tsx
            {promoted && <Badge tone="warning">⚡ Promoted</Badge>}
```

(If the detail stage has no badges container for an unverified listing, add the badge right under the listing title/meta block instead — keep it one element, tone `warning`.)

2. `greenmap/app/farms/[farmId]/sales/market/[listingId]/page.tsx` — fetch the flag and pass it:

```tsx
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TopNav } from "@/components/layout/TopNav";
import { ListingDetail } from "@/components/sales/ListingDetail";
import { getListing } from "@/components/sales/demo-listings";

export default async function ListingDetailPage({
  params,
}: {
  params: Promise<{ farmId: string; listingId: string }>;
}) {
  const { farmId, listingId } = await params;
  const listing = getListing(listingId);
  if (!listing) notFound();

  const supabase = await createClient();
  const { data } = await supabase
    .from("listing_boosts")
    .select("id")
    .eq("listing_id", listingId)
    .gt("expires_at", new Date().toISOString())
    .limit(1);

  return (
    <main className="pb-12">
      <TopNav title={listing.name} backHref={`/farms/${farmId}/sales/market`} />
      <ListingDetail farmId={farmId} listing={listing} promoted={(data ?? []).length > 0} />
    </main>
  );
}
```

- [ ] **Step 7: Type-check**

Run (in `greenmap/`): `npx tsc --noEmit` — expect exit 0.

- [ ] **Step 8: Commit**

```
git add greenmap/components/billing/BoostButton.tsx greenmap/components/sales "greenmap/app/farms/[farmId]/(tabs)/sales/page.tsx" "greenmap/app/farms/[farmId]/sales/market"
git commit -m "Add listing boosts: Boost button, Promoted sort/badges"
```

---

### Task 9: seed:billing script, smoke-test billing checks, spec correction

**Files:**
- Create: `greenmap/scripts/seed-billing.ts`
- Modify: `greenmap/package.json` (scripts)
- Modify: `greenmap/scripts/smoke-test.mjs`
- Modify: `greenmap/scripts/README.md` (one note)
- Modify: `docs/superpowers/specs/2026-07-03-payments-and-boosts-design.md` (Delivery + Demo seeding sections)

**Interfaces:**
- Produces: `npm run seed:billing` — safe demo billing state (does NOT touch farms). Smoke stage 2 fails with migration instructions when 0005 is missing; stage 3 asserts the plan page renders.

- [ ] **Step 1: seed-billing.ts**

`greenmap/scripts/seed-billing.ts`:

```ts
/**
 * Demo BILLING state — safe and farm-preserving.
 *
 * Unlike seed-demo.ts (which WIPES and recreates the demo grower's farms),
 * this only sets up the judge-demo billing arc for the demo account:
 *   plan = percuma, bonus_scans = 0, and exactly 3 scans used this month
 *   → the demo starts at "2 of 5 scans left"; two scans later the paywall
 *     appears live and you upgrade via the simulated FPX/TnG checkout.
 *
 * Run:  npm run seed:billing        (idempotent; touches ONLY the demo user)
 * Requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.local
 * and migration 0005_billing.sql applied.
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnv() {
  try {
    const text = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    for (const line of text.split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) {
        process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
      }
    }
  } catch {
    // no .env.local — rely on real environment variables
  }
}
loadEnv();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("✖ Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const DEMO_EMAIL = "ahmad@greenmap.demo";
const USED_THIS_MONTH = 3; // Percuma is 5/month → demo starts with 2 left

async function main() {
  console.log("🌱 Setting demo billing state…");

  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (error) throw error;
  const user = data.users.find((u) => u.email === DEMO_EMAIL);
  if (!user) {
    console.error(`✖ Demo user ${DEMO_EMAIL} not found — run \`npm run db:seed\` on a FRESH project first.`);
    process.exit(1);
  }

  const { error: pErr } = await admin
    .from("profiles")
    .update({ plan: "percuma", bonus_scans: 0, plan_renews_at: null })
    .eq("id", user.id);
  if (pErr) {
    console.error(
      `✖ ${pErr.message}\n  → Is migration 0005 applied? Paste supabase/migrations/0005_billing.sql into the Supabase SQL editor and run it.`
    );
    process.exit(1);
  }

  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const { error: dErr } = await admin
    .from("ai_scan_usage")
    .delete()
    .eq("user_id", user.id)
    .gte("created_at", monthStart.toISOString());
  if (dErr) throw dErr;

  const rows = Array.from({ length: USED_THIS_MONTH }, (_, i) => ({
    user_id: user.id,
    created_at: new Date(Date.now() - (i + 1) * 60_000).toISOString(),
  }));
  const { error: iErr } = await admin.from("ai_scan_usage").insert(rows);
  if (iErr) throw iErr;

  console.log(`✅ ${DEMO_EMAIL}: plan=percuma, ${USED_THIS_MONTH} of 5 scans used → 2 left.`);
  console.log("   Farms, plants and history were NOT touched.");
}

main().catch((err) => {
  console.error("✖ seed:billing failed:", err.message ?? err);
  process.exit(1);
});
```

- [ ] **Step 2: package.json script**

In `greenmap/package.json` scripts, after `"db:seed"` add:

```json
    "seed:billing": "tsx scripts/seed-billing.ts",
```

- [ ] **Step 3: smoke-test billing probes**

In `greenmap/scripts/smoke-test.mjs`, at the END of stage 2 (right after the `ok(\`plants readable …\`)` line), add:

```js
// Billing (migration 0005): payments must be readable and profiles must
// have the plan column. Missing ⇒ tell the user exactly what to run.
const billingProbe = await get("/rest/v1/payments?select=id&limit=1", authed);
const planProbe = await get("/rest/v1/profiles?select=plan&limit=1", authed);
if (!billingProbe.ok || !planProbe.ok) {
  bad("billing tables/columns missing — migration 0005 is not applied");
  die(
    "Open the Supabase dashboard → SQL editor, paste the contents of\n" +
      "  supabase/migrations/0005_billing.sql, run it, then re-run this script.\n" +
      "  (Optional demo state afterwards: `npm run seed:billing`.)"
  );
}
ok("billing tables present (payments + profiles.plan readable)");
```

In stage 3, after the `ok("scan tab renders");` line, add:

```js
  const plan = await page(`/farms/${farms[0].id}/plan`);
  const planHtml = await plan.text();
  if (plan.status !== 200 || !/Percuma|Asas|Petani Pro|Tanpa Had/.test(planHtml)) {
    bad(`My Plan page returned ${plan.status} without a tier name`);
    die();
  }
  ok("My Plan page renders tier + credits");
```

- [ ] **Step 4: README + spec corrections**

`greenmap/scripts/README.md`: under the smoke-test note at the top, add:

```md
- `npm run seed:billing` — sets the demo account's billing arc (Percuma, 2 of 5
  scans left) WITHOUT touching farms. `npm run db:seed` wipes and recreates the
  demo grower's farms — never run it against a backend holding data you care about.
```

`docs/superpowers/specs/2026-07-03-payments-and-boosts-design.md`:
- In **Demo seeding**, replace the sentence saying `scripts/seed-demo.ts` gains a billing block with: the billing state lives in a NEW standalone `scripts/seed-billing.ts` (`npm run seed:billing`), because `db:seed` wipes the demo grower's farms and must not be re-run against live data.
- In **Delivery**, replace ``then `npm run db:seed` for the demo billing state`` with ``then `npm run seed:billing` for the demo billing state (safe: farms untouched)``.

- [ ] **Step 5: Type-check + commit**

Run (in `greenmap/`): `npx tsc --noEmit` — expect exit 0.

```
git add greenmap/scripts/seed-billing.ts greenmap/package.json greenmap/scripts/smoke-test.mjs greenmap/scripts/README.md docs/superpowers/specs/2026-07-03-payments-and-boosts-design.md
git commit -m "Add safe seed:billing, smoke-test billing probes, spec fix"
```

---

### Task 10: Build, mock end-to-end arc, ship

**Files:**
- No repo changes expected (fixes only if verification finds bugs).
- Harness (NOT committed): extend `C:\Users\Dell\.claude\jobs\55083722\tmp\mock-supabase.mjs` with billing tables.

**Interfaces:**
- Consumes: everything above.
- Produces: green build, verified paywall/upgrade/boost arc, pushed branch, draft PR based on `worktree-optimize-transitions`.

- [ ] **Step 1: Production build**

Run (in `greenmap/`): `npm run build`
Expected: `✓ Compiled successfully`, route list includes `/farms/[farmId]/plan` and `/api/payments`. Fix any errors before continuing.

- [ ] **Step 2: Extend the mock Supabase**

Extend the existing mock (GoTrue + PostgREST on `127.0.0.1:54321`) with in-memory billing state: `profiles` rows gain `plan`/`bonus_scans`/`plan_renews_at`; support `GET/PATCH /rest/v1/profiles`, `GET/POST/DELETE /rest/v1/ai_scan_usage` (incl. `Prefer: count=exact` + `head` semantics via HEAD/GET with `count`), `GET/POST /rest/v1/payments` (order/limit), `GET/POST /rest/v1/listing_boosts` (`gt.expires_at` filter). Service-role key bypasses ownership checks like the real thing. Seed the mock demo user with `plan: "percuma"` and 3 usage rows this month.

- [ ] **Step 3: Drive the arc**

With `.env.local` pointed at the mock (`NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321`, no `GEMINI_API_KEY` so scans use the consuming mock path), start `npm run dev` (expect port 3001 if the user's server holds 3000) and, using a session cookie built exactly like smoke-test stage 3, verify in order:

1. `GET /farms/{farmId}/plan` → 200, contains "Percuma" and "3 of 5 scans used".
2. `POST /api/ai/scan` ×2 (json `{ imageUrl: "http://x/leaf.jpg" }`) → 200 each, `scansLeft` 1 then 0.
3. `POST /api/ai/scan` again → **402** `code: "out_of_credits"`.
4. `POST /api/payments` `{ kind: "plan", tier: "asas", method: "fpx" }` → 200 `{ ok: true, plan: "asas" }`.
5. `POST /api/ai/scan` → 200 (allowance now 20/month).
6. `POST /api/payments` `{ kind: "topup", qty: 2, method: "tng" }` → 200 `{ ok: true, bonus: 2 }`.
7. `POST /api/payments` `{ kind: "boost", listingId: "l1", package: "7d", method: "fpx" }` → 200; repeat → **409**.
8. `GET /farms/{farmId}/sales/market` → 200, HTML contains `⚡ Promoted` and l1's card is first.
9. `GET /farms/{farmId}/plan` → history shows 3 payments, all "Simulated".

Any failure: fix the code, commit the fix, re-run the failing step.

- [ ] **Step 4: Real-backend smoke (expected to flag the migration)**

Restore the real `.env.local`, run `node scripts/smoke-test.mjs` (in `greenmap/`).
Expected: stages 1–2 pass until the billing probe, which prints the "migration 0005 not applied" instructions — proving the guidance path works. (If the user has already applied 0005 by then, expect all green instead.)

- [ ] **Step 5: Clean up the junction**

Run (worktree root): `cmd /c rmdir "greenmap\node_modules"` and confirm the main checkout's `node_modules` is intact.

- [ ] **Step 6: Push + draft PR**

Push `payments-and-boosts`; create a **draft PR with base `worktree-optimize-transitions`** (stacked on PR #1) via the GitHub REST API using the `git credential fill` token (no gh CLI on this machine). PR body: feature summary, the ONE manual step (paste `0005_billing.sql` in the Supabase SQL editor), `npm run seed:billing`, and the demo script for judges (scan → paywall → upgrade → boost).

---

## Self-Review Notes

- Spec coverage: migration/RLS (T1), allowance (T2), /api/payments incl. free downgrades + 409 (T3), 402 + consume-on-success + mock-consumes (T4), checkout sheet with verbatim demo copy (T5), plan page + profile row (T6), chips/paywall/402 UI (T7), boost button/sort/badges incl. ListingDetail (T8), safe seeding + smoke probes + spec correction (T9), build + arc + stacked ship (T10). Spec's "seed-demo gains billing block" was corrected to a standalone script (T9) because `db:seed` wipes demo farms — spec updated in the same task.
- Type consistency: `ScanAllowance` fields (`plan/planName/limit/used/bonus/remaining/resetsOn/degraded`) used identically in T4, T6, T7; `PaymentPayload` defined in T5, consumed in T6/T8; API contract defined in T3, consumed in T5 (checkout), T6 (downgrade), T10 (arc).
- Known accepted gaps (per spec): check-then-insert scan race; calendar-month window with cosmetic `plan_renews_at`; boosts keyed to mock listing ids.
