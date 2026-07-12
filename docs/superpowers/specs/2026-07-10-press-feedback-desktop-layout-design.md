# Press Feedback + Desktop Layout Convergence — Design

- **Date:** 2026-07-10
- **Status:** Approved by user (brainstorming session)
- **Branch:** `press-feedback-desktop` (from `map-weather-dashboard` @ 5ccbf83)

## Problems

1. **Clicks feel unacknowledged.** Tapping buttons on `/auth` (role cards,
   Apple/Google, submit) and elsewhere gives little or no visible response.
   Root cause: Tailwind v4 preflight sets `-webkit-tap-highlight-color:
   transparent`, and several controls have no `:active` style — on phones a
   tap shows *nothing* until navigation happens.
2. **Desktop panels are inconsistent.** The landing page renders inside the
   430px phone frame (a narrow vertical column on monitors) while `/auth`
   breaks out into a wide horizontal split. Pages look like different
   products.

## Decisions (user choices during brainstorming)

| Question | Decision |
| --- | --- |
| Layout convergence direction | Landing goes wide, matching `/auth` |
| Scope | Landing **and** main app screens |
| Press feedback approach | CSS pressed-state system (no JS), **plus** extra effect: springy release + primary-button glow |
| Desktop navigation | **Left sidebar rail** (floating glass style) |

---

## Part A — Press feedback system

Modeled on Material 3 state layers / iOS touch-down highlight, tuned to the
rustic theme: pressing a control should *darken* it and *sink* it into the
parchment, instantly.

### A1. `.pressable` utility (`app/globals.css`)

- `:active` → `filter: brightness(0.92)` + `transform: translateY(1px) scale(0.98)`.
  Brightness works on **any** surface (wood gradients, glass, cream cards) —
  no per-color dark tokens needed.
- Press-in is instant (no transition on the way down); release transitions
  back over ~200ms with an **overshoot spring** —
  `cubic-bezier(0.34, 1.56, 0.64, 1)` — so the control "pops" back.
- `touch-action: manipulation` (prevents double-tap-zoom misfires).
- `@media (prefers-reduced-motion: reduce)`: keep the darkening, drop the
  transform/spring.

### A2. Primary-button glow ripple (CSS-only)

Primary CTAs (`Button` variant `primary`, auth submit) get a `::after`
radial highlight that scales up from the center and brightens while
`:active` — a center-origin "ripple" with zero JavaScript. Fades on release.
Requires `position: relative; overflow: hidden` on the button.

### A3. Global keyboard focus ring

`:focus-visible` → 2px brand-green outline, 2px offset (base layer,
app-wide). Mouse/touch users never see it; keyboard users always do.

### A4. `components/ui/Button.tsx`

- **primary:** `hover:brightness-[1.05]`, pressed darken + deeper inset
  shadow (wood shadow "compresses"), spring release, glow ripple.
- **fill:** hover bg tint up, pressed darken + sink.
- **ghost:** pressed `active:opacity-60`.
- Disabled/loading behavior unchanged.

### A5. Auth page (`app/auth/page.tsx`)

- **Role cards (Grower/Consumer):** pressed darken + sink while held —
  distinct from the persistent selected state (border + check).
- **Apple/Google:** pressed darken (`bg /70` + brightness) + sink; the busy
  state shows the small `Spinner` **and** "Opening…".
- **Submit:** pressed darken + sink + glow (replaces bare `active:scale`).
- **Mode-switch links / eye toggle:** `active:opacity-60`.

### A6. App-wide audit rule

*If it responds to a click, it must visibly respond to the press.* Apply
`.pressable` (or an explicit active state) to: AppShell tab links + scan
FAB, TopNav back button, `FarmCard`, listing/market cards, quick actions,
toggles (`StockToggle`, `SegmentedControl`), `BottomSheet` actions. The
implementation plan enumerates exact files.

---

## Part B — Desktop layout convergence (≥1024px only; phones unchanged)

### B1. One breakout mechanism

Generalize `.map-breakout` → **`.desktop-breakout`** (same media-gated
`app-frame:has()` rule at ≥1024px). The field/map page's class is renamed;
`/auth` keeps its unconditional `.auth-breakout`.

### B2. Landing page (`app/page.tsx`)

At `lg+` the page breaks out and mirrors `/auth`'s horizontal structure:

- Full-width header: logo left, Log In + Get Started right.
- Hero: two columns — headline/subtitle/CTA left, the farm-map mockup card
  grown large right (`lg:grid-cols-[6fr_5fr]`; tune only if QA shows crowding).
- Value props: 3-across row. "How it works": 3 horizontal step cards.
- Below `lg`: current vertical stack, untouched. Styling stays in the
  app's cream/glass tokens (parchment remains auth-only).

### B3. Left sidebar rail (`components/layout/AppShell.tsx`)

- New rail, `hidden lg:flex`: fixed left, floating style (16px inset,
  rounded-[26px], `glass-strong`), ~216px wide. Contents top-to-bottom:
  🌿 GreenMap wordmark, Home/Map/Sales/Profile items (icon + label, active
  = soft green pill, all `.pressable`), Scan as the gradient highlight
  button.
- Existing bottom pill: `lg:hidden`. Content wrapper: `lg:pl-[248px]
  lg:pb-8` (rail + gutter) replacing the phone-only `pb-[128px]` at `lg`.
- **`ConsumerShell` reuses the same rail component** with its own tabs.

### B4. Screen widths at `lg+`

| Screen | Treatment |
| --- | --- |
| Grower Home tab | `.desktop-breakout`, max-w ~1200px, 2-col grid (tasks + needs-care left; KPIs, weather, harvests right) |
| Sales tab | breakout, 2-col dashboard cards, listings grid |
| Profile tab | breakout, centered 720px column |
| Map tab | already wide — rename class only (rail offset comes from the shell wrapper) |
| `/farms` list | breakout, farm cards in 2–3 col grid, max-w ~1100px |
| All sub-pages (plant detail, harvest, activity, scan, sales forms, new-farm wizard, support) | breakout, centered **720px** column — no per-page redesign |
| Consumer tabs | rail + same width rules |

### B5. Non-goals

- No re-theming (glass stays glass; parchment stays auth-only).
- No new features, no data/API changes, no mobile changes.

---

## Error handling

No data flows change. OAuth/submit flows keep their existing disabled,
busy, and error states — this work only makes those states more visible.
The rail derives active state from `usePathname()` exactly as the pill does.

## Verification

1. `npm run build` + lint pass.
2. Visual QA at 390 / 768 / 1024 / 1440 px: landing, auth, farms list,
   all four grower tabs, one sub-page, consumer tabs.
3. Press feedback: every tappable on `/auth` and the shells visibly darkens
   on mouse-down / touch-down; release springs back.
4. Keyboard tab-through of `/auth` shows focus rings.
5. `prefers-reduced-motion`: darkening only, no movement.
