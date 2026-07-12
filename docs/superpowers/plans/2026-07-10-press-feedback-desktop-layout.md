# Press Feedback + Desktop Layout Convergence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every tappable control visibly darkens + sinks when pressed (CSS-only), and the landing page + logged-in app converge on wide desktop layouts (≥1024px) matching `/auth`, with a left sidebar rail.

**Architecture:** Two CSS utility classes (`.pressable`, `.pressable-glow`) in `globals.css` provide press feedback app-wide; components opt in by className. Desktop layout reuses the existing `app-frame:has()` escape-hatch pattern: a generalized `.desktop-breakout` marker (per-page) plus a `.shell-breakout` marker (set once by each tab shell), gated behind `@media (min-width: 1024px)` so phones are untouched. A new shared `SideRail` component renders desktop nav for both `AppShell` and `ConsumerShell`.

**Tech Stack:** Next.js 15 (App Router), React 19, Tailwind CSS v4 (`@utility`, `@theme`), no test framework — the automated gate is `npm run build` (type-check + compile); visual QA via `npm run dev`.

**Spec:** `docs/superpowers/specs/2026-07-10-press-feedback-desktop-layout-design.md`

## Global Constraints

- **Phones unchanged:** every layout change must be behind `lg:` (≥1024px) variants or the media-gated breakout rule. Mobile markup order may not change.
- **No new dependencies.** No JavaScript for press feedback.
- **Reduced motion:** the existing global `prefers-reduced-motion` rule kills transitions; `.pressable` must additionally drop its `:active` transform under reduced motion (darkening stays).
- **Working dir:** `greenmap/` subfolder of the repo. All `npm` commands run there.
- **Verification per task:** `npm run build` must end with "✓ Compiled successfully" (warnings about LF/CRLF are fine). No visual regression tooling exists — final task does manual QA.
- **Deliberate exclusions (do NOT touch):** chat pages (`app/consumer/support/[thread]/page.tsx`, `app/farms/[farmId]/support/page.tsx` — fragile viewport math), public passport pages (`app/passport/**` — phone-width by design), `components/dashboard/FarmDashboard.tsx` + `farm-map-dashboard.html` (old standalone prototypes), `app/error.tsx`, `app/not-found.tsx`, `app/loading.tsx` (already viewport-centered/transient).
- **Deviation from spec (approved rationale):** Sales tab gets width-only treatment (max-w 1100), internal card layout untouched — its client component is large and already reads well at 1100px single-column; consumer Market tab gets 720 like other consumer tabs.

---

### Task 1: Press-feedback CSS foundation

**Files:**
- Modify: `greenmap/app/globals.css` (append at end of file; plus one insertion in the `@layer base` block that ends at line 117)

**Interfaces:**
- Produces: plain CSS classes `.pressable` (press darken + sink + spring release) and `.pressable-glow` (center glow for primary CTAs) — later tasks reference these exact names. Also a `:focus-visible` ring (automatic, no opt-in) and a deepened pressed shadow for `.pressable.wood-btn-shadow`.

- [ ] **Step 1: Add the focus ring inside `@layer base`**

In `greenmap/app/globals.css`, find the end of the `@layer base` block (the `prefers-reduced-motion` rule at lines 107–116 is the last thing in it). Insert **before** that block's closing `}` (line 117):

```css
  /*
    Keyboard focus ring (press-feedback spec 2026-07-10). Lives in @layer
    base so component utilities (e.g. an input's `outline-none` + custom
    focus border) can still override it where a bespoke style exists.
    Mouse/touch never triggers :focus-visible, so this is keyboard-only.
  */
  :focus-visible {
    outline: 2px solid var(--color-brand);
    outline-offset: 2px;
  }
```

- [ ] **Step 2: Append the pressable utilities at the end of `globals.css`**

```css
/*
  ── Press feedback (spec 2026-07-10) ──────────────────────────────────────
  Tailwind's preflight sets -webkit-tap-highlight-color: transparent, so a
  control with no :active style shows NOTHING when tapped. Rule: if it
  responds to a click, it must visibly respond to the press.

  .pressable — the surface darkens ~8% and sinks 1px while held (works on
  any background via filter), then springs back with a slight overshoot.
  Unlayered on purpose so it beats layered Tailwind utilities (e.g. a
  hover:brightness-*) while pressed.
*/
.pressable {
  touch-action: manipulation;
  transition:
    transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1),
    filter 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.pressable:active {
  filter: brightness(0.92);
  transform: translateY(1px) scale(0.98);
  transition-duration: 0.05s; /* press-in reads as instant; release springs */
}
@media (prefers-reduced-motion: reduce) {
  .pressable:active {
    transform: none; /* keep the darkening, drop the movement */
  }
}

/* Wooden primary buttons: the outer shadow shrinks and the inner shadow
   deepens while pressed — the button visibly compresses into the page. */
.pressable.wood-btn-shadow:active {
  box-shadow:
    0 1px 2px rgb(92 58 33 / 0.25),
    inset 0 1px 1px rgb(255 255 255 / 0.15),
    inset 0 2px 6px rgb(0 0 0 / 0.28);
}

/* Center-origin glow "ripple" for primary CTAs — pure CSS, no tap-point
   tracking. Sits on ::after so it never affects the button's children. */
.pressable-glow {
  position: relative;
  overflow: hidden;
}
.pressable-glow::after {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: radial-gradient(
    circle at center,
    rgb(255 255 255 / 0.35),
    transparent 65%
  );
  opacity: 0;
  transform: scale(0.4);
  transition:
    opacity 0.3s ease,
    transform 0.3s ease;
  pointer-events: none;
}
.pressable-glow:active::after {
  opacity: 1;
  transform: scale(1.6);
  transition-duration: 0.08s;
}
```

- [ ] **Step 3: Build to verify**

Run (from `greenmap/`): `npm run build`
Expected: "✓ Compiled successfully" and the route table prints.

- [ ] **Step 4: Commit**

```bash
git add greenmap/app/globals.css
git commit -m "feat: press-feedback CSS foundation (.pressable, glow, focus ring)"
```

---

### Task 2: Upgrade the shared Button component

**Files:**
- Modify: `greenmap/components/ui/Button.tsx` (lines 7–15)

**Interfaces:**
- Consumes: `.pressable`, `.pressable-glow`, `.pressable.wood-btn-shadow:active` from Task 1.
- Produces: unchanged `Button` API (`variant`, `size`, `full`, `href`) — no call-site changes needed anywhere.

- [ ] **Step 1: Replace the class constants**

Old (lines 7–15):

```tsx
const baseClasses =
  "inline-flex items-center justify-center font-rustic font-semibold transition active:opacity-80 disabled:pointer-events-none disabled:opacity-50";

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-gradient-brand text-[#f6ecd5] wood-btn-shadow active:scale-[0.97]",
  fill: "border-2 border-[#c29b68]/50 bg-[#f6ecd5]/80 text-label backdrop-blur-md active:scale-[0.98]",
  ghost: "bg-transparent text-brand",
};
```

New:

```tsx
const baseClasses =
  "pressable inline-flex items-center justify-center font-rustic font-semibold disabled:pointer-events-none disabled:opacity-50";

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-gradient-brand text-[#f6ecd5] wood-btn-shadow pressable-glow hover:brightness-105",
  fill: "border-2 border-[#c29b68]/50 bg-[#f6ecd5]/80 text-label backdrop-blur-md hover:bg-[#f6ecd5]",
  ghost: "bg-transparent text-brand active:opacity-60",
};
```

Notes for the implementer: `.pressable` (unlayered) beats the layered `hover:brightness-105` while held, so pressed always looks darker than hover. `ghost` keeps an opacity fallback because `brightness()` is invisible on a transparent background.

- [ ] **Step 2: Build to verify**

Run: `npm run build` → "✓ Compiled successfully".

- [ ] **Step 3: Commit**

```bash
git add greenmap/components/ui/Button.tsx
git commit -m "feat: Button variants use pressable press states"
```

---

### Task 3: Auth page press states (role cards, SSO, submit, links)

**Files:**
- Modify: `greenmap/app/auth/page.tsx`

**Interfaces:**
- Consumes: `.pressable`, `.pressable-glow` from Task 1; existing `Spinner` component in the same file.

- [ ] **Step 1: SSO wood buttons — pressed darken + spinner while busy**

In `SsoBlock` (line 112), replace the `woodBtn` constant:

Old:

```tsx
  const woodBtn =
    "flex h-11 items-center justify-center gap-2 rounded-lg border-2 border-wood-medium/50 bg-[#d2b48c]/40 font-rustic text-[13px] font-medium text-wood-dark transition hover:bg-[#d2b48c]/60 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-60";
```

New:

```tsx
  const woodBtn =
    "pressable flex h-11 items-center justify-center gap-2 rounded-lg border-2 border-wood-medium/50 bg-[#d2b48c]/40 font-rustic text-[13px] font-medium text-wood-dark hover:bg-[#d2b48c]/60 disabled:pointer-events-none disabled:opacity-60";
```

Replace the two button bodies so the logo swaps to a spinner while opening:

Old:

```tsx
          <AppleLogo /> {busy === "apple" ? "Opening…" : "Apple"}
```

New:

```tsx
          {busy === "apple" ? <Spinner /> : <AppleLogo />}
          {busy === "apple" ? "Opening…" : "Apple"}
```

Old:

```tsx
          <GoogleLogo /> {busy === "google" ? "Opening…" : "Google"}
```

New:

```tsx
          {busy === "google" ? <Spinner /> : <GoogleLogo />}
          {busy === "google" ? "Opening…" : "Google"}
```

`Spinner` is declared below `SsoBlock` in the same module — function declarations hoist, so no move is needed.

- [ ] **Step 2: Primary submit button — pressable + glow**

Replace the `primaryBtn` constant (line 413):

Old:

```tsx
  const primaryBtn =
    "flex h-[50px] w-full items-center justify-center gap-2 rounded-lg wood-btn-shadow bg-meadow-green font-rustic text-[16px] font-semibold text-paper-light transition hover:bg-meadow-dark active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50";
```

New:

```tsx
  const primaryBtn =
    "pressable pressable-glow flex h-[50px] w-full items-center justify-center gap-2 rounded-lg wood-btn-shadow bg-meadow-green font-rustic text-[16px] font-semibold text-paper-light hover:bg-meadow-dark disabled:pointer-events-none disabled:opacity-50";
```

- [ ] **Step 3: Role cards — pressed darken while held**

In the role-card button (line 473–478), replace:

Old:

```tsx
                        className={cn(
                          "relative rounded-lg border-2 p-2.5 text-left transition",
```

New:

```tsx
                        className={cn(
                          "pressable relative rounded-lg border-2 p-2.5 text-left",
```

- [ ] **Step 4: Mode-switch links — active feedback**

Both mode-switch buttons (lines 609 and 620) change from:

```tsx
                className="font-semibold text-meadow-green hover:underline"
```

to:

```tsx
                className="font-semibold text-meadow-green transition-opacity hover:underline active:opacity-60"
```

(two occurrences — one in the "Already have an account?" branch, one in "New here?").

- [ ] **Step 5: Build + manual check**

Run: `npm run build` → "✓ Compiled successfully".

- [ ] **Step 6: Commit**

```bash
git add greenmap/app/auth/page.tsx
git commit -m "feat: auth page controls visibly respond to press"
```

---

### Task 4: Shell chrome press states (tab bars, FABs, TopNav)

**Files:**
- Modify: `greenmap/components/layout/AppShell.tsx` (lines 92–104, 119–128)
- Modify: `greenmap/components/layout/ConsumerShell.tsx` (lines 79–91, 105–114)
- Modify: `greenmap/components/layout/TopNav.tsx` (lines 16–19)

**Interfaces:**
- Consumes: `.pressable` from Task 1.

- [ ] **Step 1: AppShell tab links + FAB**

In `AppShell.tsx` `tabLink` (line 97), replace:

```tsx
        "flex min-w-[56px] flex-col items-center gap-0.5 rounded-2xl px-3 py-1.5 text-[10px] font-medium transition-colors",
```

with:

```tsx
        "pressable flex min-w-[56px] flex-col items-center gap-0.5 rounded-2xl px-3 py-1.5 text-[10px] font-medium transition-colors",
```

In the scan FAB (line 123), replace:

```tsx
            "-mt-9 flex h-[50px] w-[50px] items-center justify-center rounded-full text-white bg-gradient-brand shadow-fab transition active:scale-95",
```

with:

```tsx
            "pressable -mt-9 flex h-[50px] w-[50px] items-center justify-center rounded-full text-white bg-gradient-brand shadow-fab",
```

- [ ] **Step 2: ConsumerShell tab links + FAB**

Apply the identical two replacements in `ConsumerShell.tsx` (tab link class at line 84, FAB class at line 109 — same old strings, same new strings as Step 1).

- [ ] **Step 3: TopNav back link**

In `TopNav.tsx` (line 18), replace:

```tsx
          className="flex min-w-[44px] items-center gap-0.5 text-[17px] text-brand"
```

with:

```tsx
          className="flex min-w-[44px] items-center gap-0.5 text-[17px] text-brand transition-opacity active:opacity-60"
```

(A text link on glass — opacity beats brightness here.)

- [ ] **Step 4: Build to verify**

Run: `npm run build` → "✓ Compiled successfully".

- [ ] **Step 5: Commit**

```bash
git add greenmap/components/layout/AppShell.tsx greenmap/components/layout/ConsumerShell.tsx greenmap/components/layout/TopNav.tsx
git commit -m "feat: shell chrome (tabs, FABs, back) press feedback"
```

---

### Task 5: Component press-state audit sweep

**Files (each gets exact replacements below):**
- Modify: `greenmap/components/farm/FarmCard.tsx:18`
- Modify: `greenmap/app/farms/[farmId]/(tabs)/page.tsx` (home links: lines 149, 167, 218, 256)
- Modify: `greenmap/app/farms/[farmId]/(tabs)/profile/page.tsx:63`
- Modify: `greenmap/components/plant/PlantQuickActions.tsx` (lines 41 and 51)
- Modify: `greenmap/components/ui/SegmentedControl.tsx:31`
- Modify: `greenmap/components/seller/StockToggle.tsx:49`
- Modify: `greenmap/components/sales/Marketplace.tsx:161`

**Interfaces:**
- Consumes: `.pressable` from Task 1.
- Scope rule: components that already show a visible active state (e.g. `active:scale-95`, `active:bg-fill`) are compliant and stay as-is — this sweep only fixes surfaces with **no** feedback or bare-opacity feedback on primary navigation cards.

- [ ] **Step 1: FarmCard**

Old: `"block overflow-hidden rounded-card glass transition active:opacity-80"`
New: `"pressable block overflow-hidden rounded-card glass"`

- [ ] **Step 2: Home tab links (4 replacements in `(tabs)/page.tsx`)**

Line 149 old: `className="rounded-card p-3 text-center glass active:opacity-80"`
New: `className="pressable rounded-card p-3 text-center glass"`

Line 167 old: `className="mt-4 flex items-center gap-2.5 rounded-card px-3.5 py-3 glass"`
New: `className="pressable mt-4 flex items-center gap-2.5 rounded-card px-3.5 py-3 glass"`

Line 218 old: `className="mt-7 flex items-center gap-3 rounded-card p-4 glass active:opacity-80"`
New: `className="pressable mt-7 flex items-center gap-3 rounded-card p-4 glass"`

Line 256 old: `` className={`flex items-center gap-3 p-4 ${i > 0 ? "hairline-t" : ""}`} ``
New: `` className={`pressable flex items-center gap-3 p-4 ${i > 0 ? "hairline-t" : ""}`} ``

- [ ] **Step 3: Profile "My Plan" row**

Old: `className="mt-4 flex items-center justify-between gap-3 rounded-card p-4 glass transition active:bg-white/60"`
New: `className="pressable mt-4 flex items-center justify-between gap-3 rounded-card p-4 glass"`

- [ ] **Step 4: Plant quick-action tiles (both the 3 buttons and the scan Link)**

Both occurrences, old: `"flex min-h-[76px] flex-col items-center justify-center gap-1.5 rounded-squarcle py-3 glass active:opacity-80"`
New: `"pressable flex min-h-[76px] flex-col items-center justify-center gap-1.5 rounded-squarcle py-3 glass"`

- [ ] **Step 5: SegmentedControl**

Old: `"h-9 flex-1 rounded-full text-[15px] font-medium transition",`
New: `"pressable h-9 flex-1 rounded-full text-[15px] font-medium transition",`

- [ ] **Step 5b: StockToggle** (`greenmap/components/seller/StockToggle.tsx:49`)

Old: `className="flex shrink-0 items-center gap-1.5 disabled:opacity-60"`
New: `className="pressable flex shrink-0 items-center gap-1.5 disabled:opacity-60"`

- [ ] **Step 5c: Marketplace "Journey" text link** (`greenmap/components/sales/Marketplace.tsx:161`)

Old: `className="text-[13px] font-semibold text-info"`
New: `className="text-[13px] font-semibold text-info transition-opacity active:opacity-60"`

(The adjacent "Buy" link already has `active:scale-95` — leave it.)

- [ ] **Step 6: Build to verify**

Run: `npm run build` → "✓ Compiled successfully".

- [ ] **Step 7: Commit**

```bash
git add greenmap/components/farm/FarmCard.tsx "greenmap/app/farms/[farmId]/(tabs)/page.tsx" "greenmap/app/farms/[farmId]/(tabs)/profile/page.tsx" greenmap/components/plant/PlantQuickActions.tsx greenmap/components/ui/SegmentedControl.tsx greenmap/components/seller/StockToggle.tsx greenmap/components/sales/Marketplace.tsx
git commit -m "feat: press feedback on cards, tiles, toggles and text links"
```

---

### Task 6: Generalize the desktop breakout mechanism

**Files:**
- Modify: `greenmap/app/globals.css` (lines 199–210)
- Modify: `greenmap/app/farms/[farmId]/(tabs)/field/page.tsx:64`
- Modify: `greenmap/README.md:217`

**Interfaces:**
- Produces: marker classes `.desktop-breakout` (per-page opt-in for standalone pages) and `.shell-breakout` (set once by tab shells in Task 7) — at ≥1024px either releases the 430px app frame. Later tasks reference these exact names.

- [ ] **Step 1: Replace the map-breakout rule in `globals.css`**

Old (lines 199–210):

```css
/*
  Desktop breakout for the Map tab (2026-07-06 map-page spec): at ≥1024px the
  field page escapes the 430px frame into a two-column dashboard (map +
  weather/charts panel). Gated behind the media query so phones keep the
  normal app frame — unlike the auth breakout, which is unconditional.
*/
@media (min-width: 1024px) {
  .app-frame:has(.map-breakout) {
    max-width: none;
    border: none;
  }
}
```

New:

```css
/*
  Desktop breakout (2026-07-10 spec, generalizing the 2026-07-06 map rule):
  at ≥1024px a page marked .desktop-breakout — or any screen inside a tab
  shell, which sets .shell-breakout on its content wrapper — escapes the
  430px frame. Gated behind the media query so phones keep the normal app
  frame — unlike the auth breakout, which is unconditional.
*/
@media (min-width: 1024px) {
  .app-frame:has(.desktop-breakout),
  .app-frame:has(.shell-breakout) {
    max-width: none;
    border: none;
  }
}
```

- [ ] **Step 2: Update the field page marker**

In `field/page.tsx` line 64, old:

```tsx
    <main className="map-breakout mx-auto w-full max-w-[1400px] px-5 pt-12 lg:px-8 lg:pt-8">
```

New (marker kept so the page works even outside a shell; name updated):

```tsx
    <main className="desktop-breakout mx-auto w-full max-w-[1400px] px-5 pt-12 lg:px-8 lg:pt-8">
```

Also update the doc comment at line 26 that says `` (`.map-breakout`, see globals.css) `` → `` (`.desktop-breakout`, see globals.css) ``.

- [ ] **Step 3: Update README**

Line 217: replace `` `.map-breakout` `` with `` `.desktop-breakout` `` (rest of the sentence unchanged).

- [ ] **Step 4: Verify no stale references**

Run (repo root): `grep -rn "map-breakout" greenmap --include="*.tsx" --include="*.css"`
Expected: no matches.

Run: `npm run build` → "✓ Compiled successfully".

- [ ] **Step 5: Commit**

```bash
git add greenmap/app/globals.css "greenmap/app/farms/[farmId]/(tabs)/field/page.tsx" greenmap/README.md
git commit -m "refactor: generalize map-breakout into desktop-breakout + shell-breakout"
```

---

### Task 7: SideRail component + shell integration + tab-page widths

This task is atomic on purpose: the rail, the shells' `shell-breakout` wrapper, and the tab pages' width classes must land together, otherwise desktop tab screens render 430px-wide content next to a rail.

**Files:**
- Create: `greenmap/components/layout/SideRail.tsx`
- Modify: `greenmap/components/layout/AppShell.tsx`
- Modify: `greenmap/components/layout/ConsumerShell.tsx`
- Modify: `greenmap/app/farms/[farmId]/(tabs)/page.tsx:123` (width classes only)
- Modify: `greenmap/app/farms/[farmId]/(tabs)/loading.tsx:9`
- Modify: `greenmap/app/farms/[farmId]/(tabs)/profile/page.tsx:45`
- Modify: `greenmap/app/farms/[farmId]/(tabs)/scan/page.tsx:47`
- Modify: `greenmap/components/sales/SalesDashboard.tsx:52`
- Modify: `greenmap/app/consumer/(tabs)/page.tsx:35`, `greenmap/app/consumer/(tabs)/market/page.tsx`, `greenmap/app/consumer/(tabs)/orders/page.tsx:14`, `greenmap/app/consumer/(tabs)/profile/page.tsx:44`

**Interfaces:**
- Consumes: `.pressable`, `.pressable-glow` (Task 1), `.shell-breakout` rule (Task 6).
- Produces: `SideRail` component — `export function SideRail({ tabs, fab }: { tabs: RailTab[]; fab: { href: string; label: string; icon: React.ReactNode } })` with `export type RailTab = { href: string; label: string; icon: React.ReactNode; exact: boolean }`. Both shells render it; it is `hidden` below `lg`.

- [ ] **Step 1: Create `greenmap/components/layout/SideRail.tsx`**

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export type RailTab = {
  href: string;
  label: string;
  icon: React.ReactNode;
  exact: boolean;
};

/**
 * Desktop (≥1024px) navigation rail — the wide-screen counterpart of the
 * floating bottom pill (which hides itself at lg). Shared by AppShell and
 * ConsumerShell so both sides of the product get the same desktop chrome.
 * Fixed to the viewport's left edge in the same floating-glass language as
 * the pill; content shifts right via the shells' lg:pl-[248px] wrapper.
 */
export function SideRail({
  tabs,
  fab,
}: {
  tabs: RailTab[];
  fab: { href: string; label: string; icon: React.ReactNode };
}) {
  const pathname = usePathname();
  const isActive = (tab: RailTab) =>
    tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);

  return (
    <nav
      aria-label="Main"
      className="fixed bottom-4 left-4 top-4 z-30 hidden w-[216px] flex-col rounded-[26px] p-4 glass-strong lg:flex"
    >
      <p className="px-2 pb-4 pt-1 font-rustic text-[17px] font-bold text-[#5c3a21]">
        🌿 GreenMap
      </p>
      <div className="flex flex-col gap-1">
        {tabs.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "pressable flex items-center gap-3 rounded-2xl px-3 py-2.5 text-[14px] font-medium transition-colors",
              isActive(tab) ? "bg-brand/12 text-brand" : "text-secondary"
            )}
          >
            {tab.icon}
            {tab.label}
          </Link>
        ))}
      </div>
      <Link
        href={fab.href}
        className={cn(
          "pressable pressable-glow mt-auto flex h-12 items-center justify-center gap-2 rounded-2xl text-[14px] font-semibold text-white bg-gradient-brand shadow-fab",
          pathname.startsWith(fab.href) && "ring-2 ring-brand/40"
        )}
      >
        {fab.icon}
        {fab.label}
      </Link>
    </nav>
  );
}
```

- [ ] **Step 2: Integrate into `AppShell.tsx`**

Add the import at the top (after the existing imports):

```tsx
import { SideRail, type RailTab } from "@/components/layout/SideRail";
```

Type the tabs array so it satisfies `RailTab[]` — replace:

```tsx
  const tabs = [
```

with:

```tsx
  const tabs: RailTab[] = [
```

Replace the return's opening (lines 106–113):

Old:

```tsx
  return (
    <>
      {/* Room for the floating bar + raised FAB */}
      <div className="pb-[128px]">{children}</div>

      <nav
        aria-label="Main"
        className="fixed bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-1/2 z-30 flex h-16 w-[calc(100%-2rem)] max-w-[398px] -translate-x-1/2 items-center justify-around rounded-[26px] px-2 glass-strong"
      >
```

New (wrapper gains shell-breakout + desktop offsets; pill hides at lg; rail renders alongside):

```tsx
  return (
    <>
      {/* Room for the floating bar + raised FAB; at lg the rail owns nav */}
      <div className="shell-breakout pb-[128px] lg:pb-8 lg:pl-[248px]">
        {children}
      </div>

      <SideRail
        tabs={tabs}
        fab={{ href: `${base}/scan`, label: "AI Scan", icon: <SparkleIcon /> }}
      />

      <nav
        aria-label="Main"
        className="fixed bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-1/2 z-30 flex h-16 w-[calc(100%-2rem)] max-w-[398px] -translate-x-1/2 items-center justify-around rounded-[26px] px-2 glass-strong lg:hidden"
      >
```

(The `aria-label="Main"` duplication is fine — only one nav is visible per breakpoint.)

- [ ] **Step 3: Integrate into `ConsumerShell.tsx`**

Same pattern. Add the import:

```tsx
import { SideRail, type RailTab } from "@/components/layout/SideRail";
```

Change `const tabs = [` → `const tabs: RailTab[] = [`.

Replace the return's opening (lines 93–100):

Old:

```tsx
  return (
    <>
      <div className="pb-[128px]">{children}</div>

      <nav
        aria-label="Main"
        className="fixed bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-1/2 z-30 flex h-16 w-[calc(100%-2rem)] max-w-[398px] -translate-x-1/2 items-center justify-around rounded-[26px] px-2 glass-strong"
      >
```

New:

```tsx
  return (
    <>
      <div className="shell-breakout pb-[128px] lg:pb-8 lg:pl-[248px]">
        {children}
      </div>

      <SideRail
        tabs={tabs}
        fab={{ href: "/consumer/scan", label: "Scan QR", icon: <ScanIcon /> }}
      />

      <nav
        aria-label="Main"
        className="fixed bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-1/2 z-30 flex h-16 w-[calc(100%-2rem)] max-w-[398px] -translate-x-1/2 items-center justify-around rounded-[26px] px-2 glass-strong lg:hidden"
      >
```

- [ ] **Step 4: Tab-page width classes**

Grower side:

- `(tabs)/page.tsx:123` — `<main className="px-5 pt-12">` → `<main className="px-5 pt-12 lg:mx-auto lg:w-full lg:max-w-[1200px] lg:px-8 lg:pt-10">`
- `(tabs)/loading.tsx:9` — `<main className="px-5 pt-12">` → `<main className="px-5 pt-12 lg:mx-auto lg:w-full lg:max-w-[1200px] lg:px-8 lg:pt-10">`
- `(tabs)/profile/page.tsx:45` — `<main className="px-5 pb-10 pt-12">` → `<main className="px-5 pb-10 pt-12 lg:mx-auto lg:w-full lg:max-w-[720px] lg:px-8 lg:pt-10">`
- `(tabs)/scan/page.tsx:47` — `<main className="px-5 pt-12">` → `<main className="px-5 pt-12 lg:mx-auto lg:w-full lg:max-w-[720px] lg:px-8 lg:pt-10">`
- `components/sales/SalesDashboard.tsx:52` — `<main className="px-5 pb-6 pt-12">` → `<main className="px-5 pb-6 pt-12 lg:mx-auto lg:w-full lg:max-w-[1100px] lg:px-8 lg:pt-10">`

Consumer side (all four tab pages get the same suffix ` lg:mx-auto lg:w-full lg:max-w-[720px] lg:px-8 lg:pt-10` appended to their existing `<main className="...">`):

- `consumer/(tabs)/page.tsx:35` (`px-5 pb-8 pt-12`)
- `consumer/(tabs)/orders/page.tsx:14` (`px-5 pb-8 pt-12`)
- `consumer/(tabs)/profile/page.tsx:44` (`px-5 pb-8 pt-12`)
- `consumer/(tabs)/market/page.tsx:24` — this main has **no** className; its padding lives on inner divs. Old: `<main>` → New: `<main className="lg:mx-auto lg:w-full lg:max-w-[720px]">` (no `lg:px-8 lg:pt-10` here — the inner `px-5 pt-12` div keeps handling padding).

- [ ] **Step 5: Build to verify**

Run: `npm run build` → "✓ Compiled successfully".

- [ ] **Step 6: Commit**

```bash
git add greenmap/components/layout/SideRail.tsx greenmap/components/layout/AppShell.tsx greenmap/components/layout/ConsumerShell.tsx "greenmap/app/farms/[farmId]/(tabs)" greenmap/components/sales/SalesDashboard.tsx "greenmap/app/consumer/(tabs)"
git commit -m "feat: desktop sidebar rail + wide tab screens (>=1024px)"
```

---

### Task 8: Landing page desktop split hero

**Files:**
- Modify: `greenmap/app/page.tsx` (full rewrite below — mobile markup order is preserved; all changes are `lg:` additive)

**Interfaces:**
- Consumes: `.desktop-breakout` (Task 6), upgraded `Button` (Task 2).

- [ ] **Step 1: Replace the entire contents of `greenmap/app/page.tsx` with:**

```tsx
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

/**
 * Landing page. Mobile (<1024px): the original vertical stack inside the
 * phone frame. Desktop (≥1024px): escapes the frame (.desktop-breakout) into
 * a horizontal split hero + 3-across rows, mirroring /auth's wide layout
 * (2026-07-10 spec).
 */

const valueProps = [
  {
    icon: "🌿",
    title: "Visibility",
    body: "See your entire farm at a glance from bird's-eye view",
  },
  {
    icon: "🤖",
    title: "Intelligence",
    body: "AI analyses plant health and gives you diagnosis",
  },
  {
    icon: "🔍",
    title: "Transparency",
    body: "Every plant has a traceable journey from seed to harvest",
  },
];

const steps = [
  { n: 1, title: "Set up your farm map" },
  { n: 2, title: "Record every plant's journey" },
  { n: 3, title: "Consumer scans QR to see the full story" },
];

const heroMarkers = [
  { left: "18%", top: "32%", ring: "border-brand", score: "92" },
  { left: "56%", top: "20%", ring: "border-brand", score: "88" },
  { left: "74%", top: "58%", ring: "border-warning", score: "61" },
  { left: "34%", top: "68%", ring: "border-critical", score: "34" },
];

export default function LandingPage() {
  return (
    <main className="desktop-breakout pb-10 lg:pb-16">
      <div className="lg:mx-auto lg:w-full lg:max-w-[1200px] lg:px-8">
        <header className="flex items-center justify-between px-6 pt-5 lg:px-0 lg:pt-8">
          <span className="font-rustic text-[17px] font-bold text-[#5c3a21] lg:text-[20px]">
            🌿 GreenMap
          </span>
          <div className="flex items-center gap-2">
            <Link
              href="/auth"
              className="px-2 text-[15px] font-medium text-brand transition-opacity active:opacity-60"
            >
              Log In
            </Link>
            <Button href="/auth" size="sm">
              Get Started
            </Button>
          </div>
        </header>

        {/* Hero — stacked on phones, split text|visual at lg */}
        <div className="lg:grid lg:grid-cols-[6fr_5fr] lg:items-center lg:gap-12 lg:pt-16">
          <section className="px-6 pt-10 lg:px-0 lg:pt-0">
            <p className="text-[12px] font-semibold uppercase tracking-widest text-brand-dark">
              From seed to table
            </p>
            <h1 className="mt-2 font-rustic text-[34px] font-bold leading-[1.15] lg:text-[44px]">
              Every step recorded, every plant verified, every harvest trusted.
            </h1>
            <p className="mt-3 text-[16px] leading-relaxed text-secondary lg:text-[18px]">
              AI-powered farm management and harvest transparency for Malaysian
              smallholder farmers.
            </p>
            <div className="mt-6 lg:max-w-[280px]">
              <Button href="/auth" full>
                Get Started
              </Button>
            </div>
          </section>

          {/* Hero visual — bird's-eye farm map mockup with health-ring markers */}
          <section className="px-6 pt-8 lg:px-0 lg:pt-0">
            <Card className="p-0">
              <div
                aria-hidden
                className="relative h-44 overflow-hidden rounded-card bg-brand/10 lg:h-[320px]"
                style={{
                  backgroundImage:
                    "radial-gradient(rgba(79,119,45,0.25) 1.5px, transparent 1.5px)",
                  backgroundSize: "14px 14px",
                }}
              >
                {heroMarkers.map((m) => (
                  <span
                    key={m.score}
                    className={`absolute flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-[3px] bg-[#fdf9ee] text-[11px] font-bold shadow-card ${m.ring}`}
                    style={{ left: m.left, top: m.top }}
                  >
                    {m.score}
                  </span>
                ))}
              </div>
            </Card>
          </section>
        </div>

        {/* Value props — grouped rows on phones, 3-across at lg */}
        <section className="px-6 pt-8 lg:px-0 lg:pt-14">
          <Card className="p-0 lg:grid lg:grid-cols-3 lg:divide-x lg:divide-[rgb(92_58_33_/_0.16)]">
            {valueProps.map((prop, i) => (
              <div
                key={prop.title}
                className={`flex items-center gap-3 p-4 lg:flex-col lg:items-start lg:gap-2 lg:p-6 ${
                  i > 0 ? "max-lg:hairline-t" : ""
                }`}
              >
                <span
                  aria-hidden
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-brand/15 text-[18px]"
                >
                  {prop.icon}
                </span>
                <div>
                  <p className="text-[15px] font-semibold">{prop.title}</p>
                  <p className="text-[13px] text-secondary">{prop.body}</p>
                </div>
              </div>
            ))}
          </Card>
        </section>

        {/* How it works — vertical list on phones, 3 horizontal steps at lg */}
        <section className="px-6 pt-8 lg:px-0 lg:pt-12">
          <h2 className="font-rustic text-[20px] font-semibold">How it works</h2>
          <div className="mt-3 space-y-3 lg:grid lg:grid-cols-3 lg:gap-4 lg:space-y-0">
            {steps.map((step) => (
              <Card key={step.n} className="flex items-center gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand font-rustic text-[14px] font-bold text-[#f6ecd5]">
                  {step.n}
                </span>
                <p className="text-[15px] font-medium">{step.title}</p>
              </Card>
            ))}
          </div>
        </section>

        <footer className="px-6 pt-12 text-center text-[12px] leading-relaxed text-secondary lg:pt-16">
          GreenMap · From seed to table
          <br />
          Codex Community Hackathon KL 2026 · AI for Malaysia 🇲🇾
        </footer>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Build to verify**

Run: `npm run build` → "✓ Compiled successfully".

- [ ] **Step 3: Commit**

```bash
git add greenmap/app/page.tsx
git commit -m "feat: landing page splits horizontally on desktop, matching /auth"
```

---

### Task 9: Home tab desktop grid

**Files:**
- Modify: `greenmap/app/farms/[farmId]/(tabs)/page.tsx` (structure only; width classes landed in Task 7)

**Interfaces:**
- Layout contract: at `lg`, content under the greeting splits into `[minmax(0,7fr)_minmax(0,5fr)]` — left: stats + weather + tasks; right: sales row + recent activity.

- [ ] **Step 1: Open the grid after the FarmSwitcher**

Immediately after the `<FarmSwitcher ... />` element (ends line 140), insert:

```tsx
      <div className="lg:mt-2 lg:grid lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-start lg:gap-8">
        <div className="min-w-0">
```

- [ ] **Step 2: Split the columns at the sales row**

The sales `<Link href={`/farms/${farmId}/sales`}` block (starts line 216 with the comment above it) marks the start of the right column. Immediately **before** that comment (`{/* Sales — one slim row ... */}`), insert:

```tsx
        </div>

        <div className="min-w-0">
```

and change the sales Link's `mt-7` to `mt-7 lg:mt-0` (after Task 5 the class string starts `pressable mt-7 flex items-center gap-3 ...` → `pressable mt-7 lg:mt-0 flex items-center gap-3 ...`).

- [ ] **Step 3: Close the grid before `</main>`**

Immediately before the closing `</main>`, insert:

```tsx
        </div>
      </div>
```

- [ ] **Step 4: Taller activity feed on desktop**

Old (line 241): `<div className="max-h-[340px] overflow-y-auto [scrollbar-width:thin]">`
New: `<div className="max-h-[340px] overflow-y-auto [scrollbar-width:thin] lg:max-h-[480px]">`

- [ ] **Step 5: Build to verify**

Run: `npm run build` → "✓ Compiled successfully". (JSX nesting errors surface here — if the build fails with an unclosed-tag error, re-check Steps 1–3 placement.)

- [ ] **Step 6: Commit**

```bash
git add "greenmap/app/farms/[farmId]/(tabs)/page.tsx"
git commit -m "feat: home tab two-column dashboard at desktop"
```

---

### Task 10: Farms list desktop grid

**Files:**
- Modify: `greenmap/app/farms/page.tsx` (lines 49, 67, 76)

**Interfaces:**
- Consumes: `.desktop-breakout` (Task 6) — this page has no shell, so it needs its own marker.

- [ ] **Step 1: Main wrapper**

Old: `<main className="px-6 pb-12 pt-14">`
New: `<main className="desktop-breakout px-6 pb-12 pt-14 lg:mx-auto lg:w-full lg:max-w-[1100px] lg:px-8 lg:pt-16">`

- [ ] **Step 2: Card grid**

Old: `<div className="mt-6 grid grid-cols-1 gap-4">`
New: `<div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">`

- [ ] **Step 3: Constrain the create button at lg**

Old:

```tsx
          <Button href="/farms/new/profile" variant="fill" full className="mt-6">
            + Create New Farm
          </Button>
```

New:

```tsx
          <div className="mt-6 lg:max-w-[360px]">
            <Button href="/farms/new/profile" variant="fill" full>
              + Create New Farm
            </Button>
          </div>
```

- [ ] **Step 4: Build to verify**

Run: `npm run build` → "✓ Compiled successfully".

- [ ] **Step 5: Commit**

```bash
git add greenmap/app/farms/page.tsx
git commit -m "feat: farms list grid layout on desktop"
```

---

### Task 11: Sub-page 720px sweep

**Files (every `<main>` below gets the marker + width suffix):**

Rule: prepend `desktop-breakout ` to the existing className and append ` lg:mx-auto lg:w-full lg:max-w-[720px]`. These pages render outside any shell (they use `<TopNav>` or wizard chrome), so each needs its own marker. Exact strings:

| File | Old `<main className=` | New `<main className=` |
| --- | --- | --- |
| `app/farms/[farmId]/plants/[plantId]/page.tsx:86` | `"pb-12"` | `"desktop-breakout pb-12 lg:mx-auto lg:w-full lg:max-w-[720px]"` |
| `app/farms/[farmId]/plants/[plantId]/loading.tsx:6` | `"pb-12"` | `"desktop-breakout pb-12 lg:mx-auto lg:w-full lg:max-w-[720px]"` |
| `app/farms/[farmId]/plants/[plantId]/activity/page.tsx:39` | `"pb-12"` | `"desktop-breakout pb-12 lg:mx-auto lg:w-full lg:max-w-[720px]"` |
| `app/farms/[farmId]/plants/[plantId]/harvest/page.tsx:33` | `"pb-12"` | `"desktop-breakout pb-12 lg:mx-auto lg:w-full lg:max-w-[720px]"` |
| `app/farms/[farmId]/plants/[plantId]/scan/page.tsx:36` | `"pb-12"` | `"desktop-breakout pb-12 lg:mx-auto lg:w-full lg:max-w-[720px]"` |
| `app/farms/[farmId]/sales/new/page.tsx:15` | `"pb-12"` | `"desktop-breakout pb-12 lg:mx-auto lg:w-full lg:max-w-[720px]"` |
| `app/farms/[farmId]/sales/market/page.tsx:30` | `"pb-12"` | `"desktop-breakout pb-12 lg:mx-auto lg:w-full lg:max-w-[720px]"` |
| `app/farms/[farmId]/sales/market/[listingId]/page.tsx:37` | `"pb-12"` | `"desktop-breakout pb-12 lg:mx-auto lg:w-full lg:max-w-[720px]"` |
| `app/farms/[farmId]/plan/page.tsx:38` | `"pb-12"` | `"desktop-breakout pb-12 lg:mx-auto lg:w-full lg:max-w-[720px]"` |
| `app/farms/[farmId]/plan/loading.tsx:5` | `"px-5 pb-12 pt-16"` | `"desktop-breakout px-5 pb-12 pt-16 lg:mx-auto lg:w-full lg:max-w-[720px]"` |
| `app/consumer/listing/[listingId]/page.tsx:38` | `"pb-12"` | `"desktop-breakout pb-12 lg:mx-auto lg:w-full lg:max-w-[720px]"` |
| `app/consumer/orders/[orderId]/page.tsx:60` | `"pb-12"` | `"desktop-breakout pb-12 lg:mx-auto lg:w-full lg:max-w-[720px]"` |
| `app/consumer/scan/page.tsx:13` | `"px-6 pb-12 pt-2"` | `"desktop-breakout px-6 pb-12 pt-2 lg:mx-auto lg:w-full lg:max-w-[720px]"` |
| `app/farms/new/profile/page.tsx:80` | `"pb-28"` | `"desktop-breakout pb-28 lg:mx-auto lg:w-full lg:max-w-[720px]"` |
| `app/farms/new/map/page.tsx:140` | `"pb-28"` | `"desktop-breakout pb-28 lg:mx-auto lg:w-full lg:max-w-[720px]"` |
| `app/farms/new/zones/page.tsx:120` | `"pb-28"` | `"desktop-breakout pb-28 lg:mx-auto lg:w-full lg:max-w-[720px]"` |

(Do NOT touch: chat pages, passport pages, error/not-found/root-loading — see Global Constraints.)

- [ ] **Step 1: Apply all 16 replacements above**

- [ ] **Step 2: Sanity-check the sweep**

Run (repo root): `grep -rln "desktop-breakout" greenmap/app | sort`
Expected: the 16 files above plus `field/page.tsx`, `farms/page.tsx`, and `page.tsx` (landing) — 19 files total.

- [ ] **Step 3: Build to verify**

Run: `npm run build` → "✓ Compiled successfully".

- [ ] **Step 4: Commit**

```bash
git add greenmap/app
git commit -m "feat: sub-pages center at 720px on desktop"
```

---

### Task 12: Final verification + ship

**Files:** none (verification only, then PR)

- [ ] **Step 1: Full build**

Run: `npm run build` → "✓ Compiled successfully", route table lists all pages.

- [ ] **Step 2: Visual QA with the dev server**

Run: `npm run dev`, then check at widths 390 / 768 / 1024 / 1440 (browser devtools responsive mode):

1. `/` — phone: unchanged vertical stack; ≥1024: split hero, 3-across props/steps.
2. `/auth` — press each control (role cards, Apple/Google, submit, links): visible darken + sink on mouse-down, spring on release; keyboard Tab shows green focus rings.
3. `/farms` (need ≥2 farms to see the chooser) — grid at desktop.
4. Grower tabs — phone: bottom pill; ≥1024: left rail, no pill, content beside rail (Home two columns, Map dashboard unchanged, Sales 1100px, Profile 720px).
5. One sub-page (plant detail) — 720px centered at desktop, TopNav intact.
6. Consumer tabs — rail with consumer tabs, 720px content.
7. DevTools → Rendering → "Emulate CSS prefers-reduced-motion" — press states darken without movement.

- [ ] **Step 3: Smoke test (if env configured)**

Run: `npm run test:smoke` — pass if the environment has Supabase credentials; skip (note it) if not configured.

- [ ] **Step 4: Push branch + open draft PR**

```bash
git push -u origin press-feedback-desktop
gh pr create --draft --title "Press feedback system + desktop layout convergence" --base main
```

PR body should summarize both parts, link the spec, and end with the standard generated-with footer.
