# GreenMap — Prototype Style Match (Design Spec)

**Date:** 2026-06-20
**Status:** Approved design → ready for implementation plan
**Author:** Zishen + Claude

## Summary

Apply the optimized interactive prototype's visual design system to the live GreenMap web app for **every screen except the login/sign-up page (`/auth`)**. This is a **style-guide reskin only**: each screen keeps its current structure, section order, and composition — only the *look* changes (palette, typography, badges, card/button styling, spacing, micro-interactions). The one exception is a single approved navigation fix that removes a duplicated "Your Farms" list (see **Navigation / IA change** below). No desktop dashboard, no backend/logic changes.

The prototype of record is `greenmap-interactive.html` (the Phase-4 optimized version: teal/green palette, Plus Jakarta Sans + Inter, StatusBadge system, ≥44px touch targets, micro-interactions).

## Context

- **App:** Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS v4, Supabase. Mobile-first, content wrapped in a `max-w-[430px]` frame (`app/layout.tsx`). Desktop layouts explicitly deferred.
- **Design tokens are the single source of truth** in `app/globals.css` via Tailwind v4 `@theme`. Components consume tokens through utility classes (`bg-brand`, `text-secondary`, `rounded-card`, `shadow-card`, …), so a token change propagates app-wide.
- **Current palette is the iOS set** (`--color-brand: #34c759`, `--color-bg: #f2f2f7`, system font). The prototype moved to teal/green + Plus Jakarta Sans/Inter.

## Locked decisions

| Decision | Choice |
|---|---|
| Depth | Reskin + per-screen polish, **mobile-first** (no desktop dashboard) |
| Fidelity | **Style-guide only** — keep every screen's structure/order/composition; change only the look. **One exception:** the navigation/IA fix below |
| Auth page | **Pinned pixel-identical** — scope the old iOS tokens + system font to the `/auth` route so the global retokenize cannot touch it |
| Public pages | **Landing (`/`) and public Passport (`/passport/[qrToken]`) ARE redesigned** |
| Out of scope | `/auth` visuals/behavior; all Supabase/auth/middleware/AI/API/data logic; the 430px mobile frame; the `/farm-dashboard` desktop mockup |

## Approach

**Token-first + shared-primitive upgrade.** Change the `@theme` tokens once and upgrade a small set of shared UI primitives; most of the reskin propagates automatically through the existing token system. Then do a light styling pass per screen. (Rejected alternatives: per-screen inline restyling — duplicative, drifts from the token system; global CSS override layer — hacky, fights the architecture.)

## Navigation / IA change (one approved structural change)

The only change beyond the style-guide reskin. It removes the duplicated **"Your Farms"** list, which currently appears both at the post-login `/farms` selector and again on the Map tab (`/farms/[id]/map`).

- **Map tab → the farm's interactive map directly.** The Map tab opens the current farm's map (KPI strip + `FarmMap` + markers) — the content that lives today at `/farms/[id]/field`. Recommended implementation: point the Map tab at `/farms/[id]/field` and **remove/redirect** the `/farms/[id]/map` farm-list screen. The map becomes a **tab-root** screen — wrapped in `AppShell` (bottom tab bar), no back arrow.
- **Drop the duplicate farm list.** `/farms/[id]/map` no longer renders a "Your Farms" list.
- **Header farm-switcher (new `FarmSwitcher`).** The farm name at the top of the Home and Map screens becomes a tappable trigger → a bottom sheet listing the user's farms (name + plant count) and a **"Create new farm"** action (→ `/farms/new/profile`). Selecting a farm navigates to it. Reuses already-loaded farm data; no new queries beyond the existing farms fetch.
- **`/farms` selector unchanged.** Stays as the post-login entry point and the place to create/manage farms.
- **Link updates.** Any link targeting the old `/map` list is repointed; plant-detail's existing back-link to `/farms/[id]/field` keeps working (field is now the Map-tab map).

Net: the farm list lives in exactly one logical place (choosing or switching a farm), and the Map tab finally shows a map.

## Design-system changes

### 1. Tokens — `app/globals.css` `@theme`

| Token | Old (iOS) | New (prototype) |
|---|---|---|
| `--color-bg` | `#f2f2f7` | `#F5F7F8` |
| `--color-card` | `#ffffff` | `#FFFFFF` |
| `--color-label` | `#000000` | `#11181C` |
| `--color-secondary` | `#8a8a8e` | `#6B7280` |
| `--color-tertiary` (borders) | `#c7c7cc` | `#E5E7EB` |
| `--color-fill` | `#e9e9eb` | `#EEF1F2` |
| `--color-brand` | `#34c759` | `#0DB074` |
| `--color-brand-dark` | `#248a3d` | `#0A8A5C` |
| `--color-teal` (NEW) | — | `#1E434A` |
| `--color-warning` | `#ff9f0a` | `#F59E0B` |
| `--color-critical` | `#ff3b30` | `#EF4444` |
| `--color-info` | `#007aff` | `#3B82F6` |

Radii kept (`--radius-card: 20px`, etc.). `--shadow-card` softened toward the prototype (`0 4px 14px rgb(16 40 46 / 0.05)`). `--shadow-fab` recolored to the new green.

### 2. Fonts — `app/layout.tsx` via `next/font/google`

- **Plus Jakarta Sans** (600/700/800) → `--font-head` (headings, large titles, KPI/score numbers).
- **Inter** (400/500/600/700) → `--font-sans` (body, labels, metadata).
- Body uses Inter; a `.font-head` utility (or component-level class) applies Jakarta to headings. Update `--font-sans` in `@theme` to the Inter stack.

### 3. Auth pinning (`/auth` stays identical)

Add an `.ios-pin` scope class in `globals.css` that re-declares the **old** token values and system font:

```css
.ios-pin {
  --color-bg:#f2f2f7; --color-card:#fff; --color-label:#000;
  --color-secondary:#8a8a8e; --color-tertiary:#c7c7cc; --color-fill:#e9e9eb;
  --color-brand:#34c759; --color-brand-dark:#248a3d;
  --color-warning:#ff9f0a; --color-critical:#ff3b30; --color-info:#007aff;
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text",
    "Helvetica Neue", "Inter", Arial, sans-serif;
}
```

Apply `.ios-pin` to the auth page's root `<main>`. Because Tailwind v4 utilities resolve to `var(--color-*)` at use-site, scoping the variables on a wrapper makes the auth page (and its children: SunflowerScene, PasswordChecklist, Button, SegmentedControl, Field) render with the old look. **Verification step (below) must confirm the override actually wins.** Auth layout, copy, sunflower animation, and password logic are untouched.

### 4. Shared primitives (upgrade in place)

- **`Badge` → StatusBadge variants:** healthy / attention / critical / completed / pending / overdue / ai / manual — tinted background + strong text, per prototype. Preserve the existing `tone` prop; map tones → variants.
- **`Button`:** hover brightness + `active:scale(.98)`, `min-height: 48px`.
- **`Card`:** subtle hover/press transition.
- **`KpiStrip`:** prototype styling (icon tints, Jakarta numbers, teal Total).
- **`EmptyState`:** restyle to new palette/type.
- **`HealthScoreRing` (new or aligned):** teal number + status-colored ring, used on plant detail.
- **Typography:** heading utility applies Jakarta to `large-title`, `h1/h2`, and numeric stats.
- **Touch targets:** list items ≥44–52px, tabs ≥44px.

### 5. Micro-interactions

Hover + active feedback and smooth transitions on buttons, cards, and list items; continue to respect the existing global `prefers-reduced-motion` rule.

## Screens in scope (restyle only — structure unchanged)

`/` landing · `/farms` selector (`FarmCard`) · `/farms/new/{profile,map,zones}` setup wizard · `/farms/[id]` Home (`TodaysTasks`, quick stats, activity) · `/farms/[id]/map` (farm-list screen — **removed/redirected**, see Navigation change) · `/farms/[id]/field` (`KpiStrip`, `FarmMap`, `PlantMarker`) — **becomes the Map-tab root** · `/farms/[id]/plants/[pid]` (`SuggestionCard`, `HealthTrendChart`, `ManualStatusControl`, `PlantQuickActions`, `ActivityTimeline`) · `/farms/[id]/plants/[pid]/scan` · `/farms/[id]/plants/[pid]/activity` · `/farms/[id]/plants/[pid]/harvest` (`HarvestConfirm`) · `/farms/[id]/sales` (`EmptyState`) · `/farms/[id]/profile` (`ProfileClient`) · `/consumer` · `/passport/[qrToken]` (public) · shared `AppShell` (tab bar) + `TopNav`.

## Health-band → color mapping (logic unchanged, colors only)

- Healthy ≥ 70 → brand green `#0DB074`
- Attention 40–69 → warning amber `#F59E0B`
- Critical 0–39 → critical red `#EF4444`
- New / null → tertiary grey `#E5E7EB`

## Explicitly NOT changing

`/auth` visuals & behavior (pinned) · Supabase/auth/middleware/AI-scan/API routes/data flow/business logic · the mobile-first 430px frame (no desktop SaaS dashboard) · the `/farm-dashboard` route and `farm-map-dashboard.html` mockup (orphaned, left as-is).

## Verification / testing

- `next build` + TypeScript/lint pass.
- Visual spot-check of every in-scope screen against the prototype (palette, fonts, badges, spacing).
- Confirm `/auth` renders **pixel-identical** to current `main` (compare against git HEAD / screenshot).
- `git diff` scoped to UI files + `globals.css` + `layout.tsx` only — confirm no backend/logic files changed.

## Risks / notes

- **Tailwind v4 token override:** the `.ios-pin` scoped re-declaration must be verified to actually override the global tokens for `/auth` (test in a build, not just assumed).
- **`next/font`:** two families added — keep weights minimal for performance.
- **Hardcoded hex:** some components already hardcode hex (e.g., `KpiStrip`, `FarmDashboard`). In-scope components are aligned to tokens; `FarmDashboard` is out of scope.

## Rollout order (for the implementation plan)

1. Tokens + fonts (`globals.css`, `layout.tsx`).
2. Auth pin — verify `/auth` unchanged.
3. Shared primitives (Badge/Button/Card/KpiStrip/EmptyState/HealthScoreRing/typography).
4. Navigation/IA: point the Map tab at the farm map, remove the duplicate `/map` farm-list, add the `FarmSwitcher` header sheet, repoint affected links.
5. Screen styling pass (each in-scope screen).
6. Verify (build + visual + auth-unchanged + scoped diff).
