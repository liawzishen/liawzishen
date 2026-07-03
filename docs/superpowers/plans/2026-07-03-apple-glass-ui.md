# Apple Liquid-Glass UI Restyle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-skin GreenMap to Apple's Liquid Glass language — Garden ambient background, translucent blurred panels, floating glass pill tab bar with real icons, gradient accents — with zero layout/feature/backend changes.

**Architecture:** All changes flow through `app/globals.css` (tokens + `glass`/`glass-strong`/`glass-sheet` utilities + ambient body wash) and the shared primitives (`Card`, `Button`, `Input`, `Skeleton`, `BottomSheet`, `AppShell`, `TopNav`); a final mechanical sweep converts raw `bg-card`/`shadow-card`/`bg-bg/85` usages that bypass the primitives.

**Tech Stack:** Next.js 15 App Router, Tailwind v4 (`@theme`, `@utility` with nested `@supports`/`@media`), no new dependencies.

**Spec:** `docs/superpowers/specs/2026-07-03-apple-glass-ui-design.md`

## Global Constraints

- App in `greenmap/`; branch `apple-glass-ui` (already checked out, off merged `main`).
- **Re-skin only** — no layout, navigation, feature, copy, data, or backend changes; light mode only (dark = Phase 2).
- Glass on chrome + top-level cards only — never on list rows/inner fills (performance).
- Fallbacks required inside each glass utility: `@supports not (backdrop-filter: blur(1px))` and `@media (prefers-reduced-transparency: reduce)` → `background: rgb(255 255 255 / 0.92)`.
- Verification ladder: `npx tsc --noEmit` per task → `npm run build` → dev server + smoke/HTML checks (no unit-test framework exists).
- node_modules junction (PowerShell, worktree root): create `New-Item -ItemType Junction -Path "greenmap\node_modules" -Target "C:\Users\Dell\Documents\greenmap phas4\greenmap\node_modules"`; remove ONLY `cmd /c rmdir "greenmap\node_modules"`.
- Commits end with the standard `Co-Authored-By: Claude Fable 5` + `Claude-Session` trailers used on this branch.

---

### Task 1: Visual system in globals.css

**Files:**
- Modify: `greenmap/app/globals.css` (full replacement below)

**Interfaces:**
- Produces (used by every later task): utilities `glass`, `glass-strong`, `glass-sheet`, `bg-gradient-brand`; tokens `--color-bg: #eef3ef`, `--color-secondary: #6d7076`, `--shadow-card`, `--shadow-fab`, `--gradient-brand`; ambient wash on `body::before`.

- [ ] **Step 1: Ensure the node_modules junction exists** (see Global Constraints; skip if present)

- [ ] **Step 2: Replace `greenmap/app/globals.css` with:**

```css
@import "tailwindcss";

/*
  GreenMap design tokens — single source of truth.
  2026-07-03: Liquid Glass restyle (docs/superpowers/specs/
  2026-07-03-apple-glass-ui-design.md) — Garden ambient wash + glass
  surfaces. Layouts and structure unchanged. Dark mode = Phase 2.
*/
@theme {
  /* iOS system colours (bg + secondary retuned for the glass look) */
  --color-bg: #eef3ef; /* green-tinted base under the ambient wash */
  --color-card: #ffffff; /* opaque surfaces (inputs on photos, QR block) */
  --color-label: #000000; /* primary text */
  --color-secondary: #6d7076; /* secondary text — darkened for glass panels */
  --color-tertiary: #c7c7cc; /* borders, dividers, chevrons, "New" marker */
  --color-fill: #e9e9eb; /* segmented controls, pressed states */

  /* Brand */
  --color-brand: #34c759; /* primary actions, active tabs, healthy */
  --color-brand-dark: #248a3d; /* text on light green badges */

  /* Status & plant health */
  --color-warning: #ff9f0a; /* attention (health 40–69), PREVIEW badges */
  --color-critical: #ff3b30; /* critical (health 0–39) */
  --color-info: #007aff; /* AI suggestions, info, water */

  /* Typography — SF Pro on Apple, system sans elsewhere. No serif anywhere. */
  --font-sans:
    -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text",
    "Helvetica Neue", "Inter", Arial, sans-serif;

  /* Border radius (06 §7) */
  --radius-card: 20px; /* cards, grouped lists */
  --radius-btn: 14px; /* buttons */
  --radius-input: 12px; /* inputs */
  --radius-squarcle: 20px; /* 60×60 quick-action tiles */

  /* Shadows — softer, deeper, green-gray for the glass look */
  --shadow-card: 0 8px 20px rgb(20 50 35 / 0.08);
  --shadow-fab: 0 0 0 4px rgb(255 255 255 / 0.35), 0 6px 16px rgb(52 199 89 / 0.5);
}

@layer base {
  :root {
    /* Brand gradient for primary buttons + the scan FAB */
    --gradient-brand: linear-gradient(145deg, #3ddb6c, #28b04e);
  }

  html {
    -webkit-tap-highlight-color: transparent;
    -webkit-text-size-adjust: 100%;
  }

  body {
    @apply bg-bg font-sans text-label antialiased;
  }

  /*
    Ambient Garden wash — fixed so glass panels always have colour to blur.
    Lives on ::before (z -1) so it never scrolls and never catches events.
  */
  body::before {
    content: "";
    position: fixed;
    inset: 0;
    z-index: -1;
    pointer-events: none;
    background:
      radial-gradient(42rem 42rem at 12% 8%, rgb(52 199 89 / 0.18), transparent 70%),
      radial-gradient(48rem 48rem at 95% 22%, rgb(48 209 150 / 0.14), transparent 70%),
      radial-gradient(50rem 50rem at 35% 95%, rgb(64 200 224 / 0.13), transparent 70%),
      radial-gradient(36rem 36rem at 78% 65%, rgb(172 224 110 / 0.12), transparent 70%),
      #eef3ef;
  }

  /* iOS pattern: respect users who prefer reduced motion (06 §13) */
  @media (prefers-reduced-motion: reduce) {
    *,
    *::before,
    *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
    }
  }
}

/* 0.5px iOS hairline separators (Tailwind v4 custom utilities) */
@utility hairline-t {
  border-top: 0.5px solid rgb(0 0 0 / 0.1);
}
@utility hairline-b {
  border-bottom: 0.5px solid rgb(0 0 0 / 0.1);
}

/*
  Liquid Glass surfaces. `glass` = cards / top-level panels;
  `glass-strong` = chrome (tab bar, headers, sticky CTAs);
  `glass-sheet` = bottom sheets hosting forms (whiter for readability).
  Each carries its own no-blur / reduced-transparency fallback.
*/
@utility glass {
  background: rgb(255 255 255 / 0.55);
  backdrop-filter: blur(16px) saturate(170%);
  border: 1px solid rgb(255 255 255 / 0.65);
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 0.9),
    0 8px 20px rgb(20 50 35 / 0.1);
  @supports not (backdrop-filter: blur(1px)) {
    background: rgb(255 255 255 / 0.92);
  }
  @media (prefers-reduced-transparency: reduce) {
    background: rgb(255 255 255 / 0.92);
    backdrop-filter: none;
  }
}
@utility glass-strong {
  background: rgb(255 255 255 / 0.62);
  backdrop-filter: blur(24px) saturate(180%);
  border: 1px solid rgb(255 255 255 / 0.65);
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 0.9),
    0 10px 26px rgb(20 50 35 / 0.14);
  @supports not (backdrop-filter: blur(1px)) {
    background: rgb(255 255 255 / 0.92);
  }
  @media (prefers-reduced-transparency: reduce) {
    background: rgb(255 255 255 / 0.92);
    backdrop-filter: none;
  }
}
@utility glass-sheet {
  background: rgb(255 255 255 / 0.8);
  backdrop-filter: blur(24px) saturate(180%);
  border: 1px solid rgb(255 255 255 / 0.65);
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 0.9),
    0 10px 26px rgb(20 50 35 / 0.14);
  @supports not (backdrop-filter: blur(1px)) {
    background: rgb(255 255 255 / 0.96);
  }
  @media (prefers-reduced-transparency: reduce) {
    background: rgb(255 255 255 / 0.96);
    backdrop-filter: none;
  }
}

/* Brand gradient fill (primary buttons, scan FAB) */
@utility bg-gradient-brand {
  background-image: var(--gradient-brand);
}

/*
  Page-enter transition — iOS-style fade + rise. Every screen's root is a
  <main> that remounts once per navigation, so this plays exactly once per
  visit (the reduced-motion override above disables it). Ends at
  `transform: none`, so sticky/fixed descendants are unaffected after entry.
*/
@layer base {
  main {
    animation: page-enter 0.28s cubic-bezier(0.25, 0.1, 0.25, 1);
  }

  @keyframes page-enter {
    from {
      opacity: 0;
      transform: translateY(6px);
    }
    to {
      opacity: 1;
      transform: none;
    }
  }
}
```

- [ ] **Step 3: Type-check** — Run (in `greenmap/`): `npx tsc --noEmit` → exit 0.

- [ ] **Step 4: Commit**

```
git add greenmap/app/globals.css
git commit -m "Liquid Glass visual system: ambient wash, glass utilities, tokens"
```

---

### Task 2: Primitives — Card, Button, Input, Skeleton, BottomSheet

**Files:**
- Modify: `greenmap/components/ui/Card.tsx`, `Button.tsx`, `Input.tsx`, `Skeleton.tsx`, `BottomSheet.tsx`

**Interfaces:**
- Consumes: `glass`, `glass-sheet`, `bg-gradient-brand` (Task 1).
- Produces: unchanged component APIs — only class strings change (no prop changes, so zero call-site churn).

- [ ] **Step 1: Card** — in `Card.tsx` replace the div class:

```tsx
    <div className={cn("rounded-card p-4 glass", className)}>
```

(Doc comment: `/** Glass card (Liquid Glass spec): radius 20, translucent blur panel, 16px padding. */`)

- [ ] **Step 2: Button** — in `Button.tsx` replace `variantClasses`:

```tsx
const variantClasses: Record<Variant, string> = {
  primary:
    "bg-gradient-brand text-white shadow-[0_6px_16px_rgb(52_199_89/0.35)] active:scale-[0.97]",
  fill: "border border-white/60 bg-white/60 text-label backdrop-blur-md active:scale-[0.98]",
  ghost: "bg-transparent text-brand",
};
```

(Base classes already include `transition active:opacity-80` — the scale composes with it.)

- [ ] **Step 3: Input** — replace the input's surface classes:

```tsx
          "h-12 w-full rounded-input border border-white/60 bg-white/70 px-4 text-[16px] text-label placeholder:text-secondary",
```

- [ ] **Step 4: Skeleton** — replace the class: `"animate-pulse rounded-input bg-white/50"`.

- [ ] **Step 5: BottomSheet** — in the sheet panel `cn(...)`, replace
  `"relative w-full max-w-[430px] rounded-t-card bg-card px-6 pb-8 pt-3 shadow-card outline-none"` with
  `"relative w-full max-w-[430px] rounded-t-[26px] glass-sheet px-6 pb-8 pt-3 outline-none"`.

- [ ] **Step 6: Type-check + commit**

Run (in `greenmap/`): `npx tsc --noEmit` → exit 0.

```
git add greenmap/components/ui
git commit -m "Glass primitives: Card, Button, Input, Skeleton, BottomSheet"
```

---

### Task 3: Chrome — AppShell pill bar with SVG icons + TopNav

**Files:**
- Modify: `greenmap/components/layout/AppShell.tsx` (full replacement below)
- Modify: `greenmap/components/layout/TopNav.tsx` (one line)

**Interfaces:**
- Consumes: `glass-strong`, `bg-gradient-brand`, `shadow-fab` (Task 1).
- Produces: `AppShell({ farmId, children })` — same API; content wrapper bottom padding becomes 128px.

- [ ] **Step 1: Replace `AppShell.tsx` with:**

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/*
 * 5-tab grower shell (06 §9): Home · Map · Scan(FAB) · Sales · Profile.
 * Liquid Glass restyle: floating glass pill bar detached from the screen
 * edges, SF-style line icons, soft green pill on the active tab, gradient
 * scan FAB. Rendered once by app/farms/[farmId]/(tabs)/layout.tsx so the
 * bar stays mounted across tab switches; pushed sub-pages use <TopNav />.
 */

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

function HomeIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" {...stroke} aria-hidden>
      <path d="M3.5 10.5 12 3.5l8.5 7" />
      <path d="M5.5 9.7V19a1.5 1.5 0 0 0 1.5 1.5h10A1.5 1.5 0 0 0 18.5 19V9.7" />
      <path d="M9.6 20.3v-5.1a1 1 0 0 1 1-1h2.8a1 1 0 0 1 1 1v5.1" />
    </svg>
  );
}
function MapIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" {...stroke} aria-hidden>
      <path d="M9 4 3.5 6v14L9 18l6 2 5.5-2V4L15 6 9 4Z" />
      <path d="M9 4v14" />
      <path d="M15 6v14" />
    </svg>
  );
}
function SalesIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" {...stroke} aria-hidden>
      <rect x="3" y="6.5" width="18" height="11" rx="2.5" />
      <circle cx="12" cy="12" r="2.6" />
      <path d="M6.4 9.9h.01M17.6 14.1h.01" />
    </svg>
  );
}
function ProfileIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" {...stroke} aria-hidden>
      <circle cx="12" cy="8.2" r="3.4" />
      <path d="M4.8 19.6c1.6-3.1 4.1-4.7 7.2-4.7s5.6 1.6 7.2 4.7" />
    </svg>
  );
}
function SparkleIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden>
      <path
        d="M12 3.8 13.7 9l5.2 1.7-5.2 1.7L12 17.6l-1.7-5.2L5.1 10.7 10.3 9 12 3.8Z"
        fill="currentColor"
      />
      <circle cx="18.6" cy="17.4" r="1.5" fill="currentColor" />
    </svg>
  );
}

export function AppShell({
  farmId,
  children,
}: {
  farmId: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const base = `/farms/${farmId}`;

  const tabs = [
    { href: base, label: "Home", icon: <HomeIcon />, exact: true },
    { href: `${base}/field`, label: "Map", icon: <MapIcon />, exact: false },
    { href: `${base}/sales`, label: "Sales", icon: <SalesIcon />, exact: false },
    { href: `${base}/profile`, label: "Profile", icon: <ProfileIcon />, exact: false },
  ];

  const isActive = (tab: { href: string; exact: boolean }) =>
    tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);

  const tabLink = (tab: (typeof tabs)[number]) => (
    <Link
      key={tab.href}
      href={tab.href}
      className={cn(
        "flex min-w-[56px] flex-col items-center gap-0.5 rounded-2xl px-3 py-1.5 text-[10px] font-medium transition-colors",
        isActive(tab) ? "bg-brand/12 text-brand" : "text-secondary"
      )}
    >
      {tab.icon}
      {tab.label}
    </Link>
  );

  return (
    <>
      {/* Room for the floating bar + raised FAB */}
      <div className="pb-[128px]">{children}</div>

      <nav
        aria-label="Main"
        className="fixed bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-1/2 z-30 flex h-16 w-[calc(100%-2rem)] max-w-[398px] -translate-x-1/2 items-center justify-around rounded-[26px] px-2 glass-strong"
      >
        {tabLink(tabs[0])}
        {tabLink(tabs[1])}

        {/* Centre Scan FAB — the signature action (06 §9) */}
        <Link
          href={`${base}/scan`}
          aria-label="AI Scan"
          className={cn(
            "-mt-9 flex h-[50px] w-[50px] items-center justify-center rounded-full text-white bg-gradient-brand shadow-fab transition active:scale-95",
            pathname.startsWith(`${base}/scan`) && "ring-2 ring-brand/40"
          )}
        >
          <SparkleIcon />
        </Link>

        {tabLink(tabs[2])}
        {tabLink(tabs[3])}
      </nav>
    </>
  );
}
```

- [ ] **Step 2: TopNav** — replace the header class with:

```tsx
    <header className="sticky top-0 z-20 glass-strong hairline-b">
```

- [ ] **Step 3: Type-check + commit**

Run (in `greenmap/`): `npx tsc --noEmit` → exit 0.

```
git add greenmap/components/layout
git commit -m "Floating glass pill tab bar with line icons; glass TopNav"
```

---

### Task 4: Surface sweep — raw bg-card / shadow-card / sticky bars

**Files (grep-verified, 2026-07-03; counts are `bg-card|bg-white/8|bg-white/9|bg-bg/85|shadow-card` hits):**
`app/auth/page.tsx`(1) · `app/page.tsx`(1) · `app/passport/[qrToken]/page.tsx`(1) · `components/home/TodaysTasks.tsx`(3) · `app/farms/new/zones/page.tsx`(3) · `app/farms/[farmId]/(tabs)/scan/page.tsx`(1) · `components/billing/PlanPageClient.tsx`(6) · `app/farms/new/profile/page.tsx`(1) · `app/farms/new/map/page.tsx`(4) · `app/farms/[farmId]/(tabs)/page.tsx`(1) · `app/farms/[farmId]/(tabs)/profile/page.tsx`(1) · `components/farm/FarmSwitcher.tsx`(1) · `components/plant/PlantQuickActions.tsx`(2) · `components/farm/FarmCard.tsx`(1) · `components/farm/FarmMapCanvas.tsx`(1) · `components/farm/AddPlantModal.tsx`(1) · `app/farms/[farmId]/plants/[plantId]/scan/page.tsx`(1) · `components/farm/FarmMap.tsx`(4) · `components/farm/KpiStrip.tsx`(1) · `components/profile/ProfileClient.tsx`(4) · `components/sales/SalesDashboard.tsx`(1) · `components/sales/ListingDetail.tsx`(9) · `components/sales/Marketplace.tsx`(4) · `components/sales/ListHarvestForm.tsx`(2) · `components/passport/HarvestPassportCard.tsx`(1)

**Mechanical rules (apply per occurrence):**
1. Class list containing **both `bg-card` and `shadow-card`** (a top-level panel) → delete both, add `glass` (keep all other classes, incl. `rounded-card`/`overflow-hidden`).
2. **`shadow-card` alone** on a white/solid element (e.g., product-card container `bg-card` handled by rule 1; standalone `shadow-card` on `bg-white` chips) → keep — the token itself was retuned in Task 1.
3. **`bg-card` alone** used as a *pressed/hover state* (`active:bg-card`) or a small element **sitting on glass** → `active:bg-white/60` / `bg-white/50` respectively. Plain-page small fills stay `bg-fill`.
4. **`bg-bg/85 backdrop-blur-xl` sticky CTA bars** (2× in `ListingDetail.tsx`) → replace those two classes with `glass-strong` (keep positioning classes).
5. **`bg-white/90` pills on photos/gradients** (Marketplace, ListingDetail heroes, promoted tags) → keep as-is (already glassy on imagery).
6. **`ring-card`** (avatar ring in ProfileClient) → `ring-white/80`.
7. **Farm map surfaces** (`FarmMap.tsx`, `FarmMapCanvas.tsx`): floating chips/legend/panels → rule 1; anything that is the canvas backdrop itself → leave untouched (the satellite/plot image must stay opaque).

- [ ] **Step 1:** Apply rules across all listed files (grep each file for the pattern, edit every hit per rules).
- [ ] **Step 2:** Re-run the grep — remaining hits must all be rule-2/5 keepers or `--shadow-card` token users. `bg-bg/85` must have 0 hits.
- [ ] **Step 3: Type-check + commit**

Run (in `greenmap/`): `npx tsc --noEmit` → exit 0.

```
git add greenmap/app greenmap/components
git commit -m "Sweep raw surfaces to glass; sticky CTAs to glass-strong"
```

---

### Task 5: Verify and ship (draft PR #3)

**Files:** none expected (fixes only if verification finds issues).

- [ ] **Step 1: Build** — Run (in `greenmap/`): `npm run build` → `✓ Compiled successfully`, same route list as before.
- [ ] **Step 2: Render check** — start `npm run dev -- -p 3789` (real `.env.local`); with a session cookie built like smoke-test stage 3 against the real backend, GET the farm home, scan tab, sales, marketplace, plan page → all 200 and the HTML contains `glass-strong` (tab bar/TopNav) and `glass` (cards). Farm name still renders (data unaffected).
- [ ] **Step 3: Smoke** — `node scripts/smoke-test.mjs` → stages 1–2 green (billing probe may still say "run 0005" if the user hasn't applied the migration — that's pre-existing, not this PR).
- [ ] **Step 4: Cleanup** — stop dev server; `cmd /c rmdir "greenmap\node_modules"`; confirm the main checkout's node_modules intact.
- [ ] **Step 5: Ship** — push `apple-glass-ui`; create **draft PR #3, base `main`** via `git credential fill` + GitHub REST (no gh CLI). Body: what changed visually, zero-feature-change note, fallbacks, and "pull + look" review instructions.
- [ ] **Step 6:** Push a "done" screen to the visual companion with the PR link; update project memory.

---

## Self-Review Notes

- Spec coverage: ambient wash + tokens + 3 glass utilities + gradient (T1); Card/Button/Input/Skeleton/BottomSheet (T2); pill bar + SVG icons + FAB + TopNav (T3); per-screen touch-ups incl. auth, passport, plan, marketplace, farm-map chips, sticky CTAs (T4); verification + PR #3 (T5). Dark mode/layout changes correctly absent.
- Type consistency: component APIs unchanged; only class strings — no cross-task signatures beyond utility names (`glass`, `glass-strong`, `glass-sheet`, `bg-gradient-brand`) which match T1 exactly.
- Sweep task uses mechanical rules + a grep-frozen file list instead of 59 verbatim diffs; executor re-greps per file, and Step 2's re-grep is the completeness gate.
