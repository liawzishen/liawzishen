# Apple Liquid-Glass UI Restyle — Design

**Date:** 2026-07-03
**Status:** Approved (user chose Liquid Glass + Garden palette + design-system approach via visual companion; both design sections approved)

## Goal

Lift GreenMap's flat iOS-gray skin to Apple's current design language: **Liquid Glass** — translucent, blurred panels over a colorful ambient background, floating glass chrome, gradient accents. Purely a re-skin: **no layout, navigation, feature, copy, or backend changes.**

## User decisions (2026-07-03, visual companion session)

| Decision | Choice |
|---|---|
| Style intensity | **C · Liquid Glass** (bold; clicked 11×) over flat/frosted-subtle |
| Ambient palette | **1 · Garden** — brand green + teal + cyan + soft lime glows |
| Build approach | **A · Restyle the design system** (tokens + shared components; screens inherit) |
| Tab icons | Replace emoji (🏠🗺️💰👤) with Apple-style SVG line icons |

## Out of scope

Dark mode (stays Phase 2), layout/IA changes, new features, farm-map canvas internals, backend/data.

## Visual system (`greenmap/app/globals.css`)

### Ambient Garden background
- `--color-bg` becomes `#eef3ef` (soft green-tinted base).
- A **fixed, non-scrolling wash** rendered via `body::before` (position fixed, inset 0, `z-index: -1`, `pointer-events: none`):
  ```css
  background:
    radial-gradient(42rem 42rem at 12% 8%,  rgb(52 199 89 / 0.18),  transparent 70%),
    radial-gradient(48rem 48rem at 95% 22%, rgb(48 209 150 / 0.14), transparent 70%),
    radial-gradient(50rem 50rem at 35% 95%, rgb(64 200 224 / 0.13), transparent 70%),
    radial-gradient(36rem 36rem at 78% 65%, rgb(172 224 110 / 0.12), transparent 70%);
  ```
- Applies globally (grower app, auth, public Harvest Passport) since it's body-level.

### Glass utilities (Tailwind v4 `@utility`)
- **`glass`** (cards, top-level surfaces):
  `background: rgb(255 255 255 / 0.55); backdrop-filter: blur(16px) saturate(170%); border: 1px solid rgb(255 255 255 / 0.65); box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.9), 0 8px 20px rgb(20 50 35 / 0.10);`
- **`glass-strong`** (chrome: tab bar, TopNav, sticky CTAs):
  `background: rgb(255 255 255 / 0.62); backdrop-filter: blur(24px) saturate(180%);` same border; `box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.9), 0 10px 26px rgb(20 50 35 / 0.14);`
- **`glass-sheet`** (bottom sheets hosting forms): same as `glass-strong` but `background: rgb(255 255 255 / 0.80)` — its own utility so no class-order ambiguity.
- **Fallbacks nested inside each utility:** under `@supports not (backdrop-filter: blur(1px))` and `@media (prefers-reduced-transparency: reduce)`, background becomes `rgb(255 255 255 / 0.92)` (near-solid). Existing `prefers-reduced-motion` rule unchanged.
- **Performance cap:** glass on chrome + top-level cards only — never on list rows/inner fills (cheap-phone friendly).

### Token refinements
- `--color-secondary`: `#8a8a8e` → `#6d7076` (contrast on translucent panels).
- `--shadow-card`: → `0 8px 20px rgb(20 50 35 / 0.08)` (softer, deeper, green-gray).
- `--shadow-fab`: → `0 0 0 4px rgb(255 255 255 / 0.35), 0 6px 16px rgb(52 199 89 / 0.5)` (white ring + glow).
- New `--gradient-brand` (used by primary buttons + FAB): `linear-gradient(145deg, #3ddb6c, #28b04e)`.

## Component changes (shared components; screens inherit)

| Component | Change |
|---|---|
| `AppShell` tab bar | Floating **glass pill**: detached (`w-[calc(100%-2rem)]`, max 398px, bottom gap w/ safe-area), `h-[64px]`, `rounded-[26px]`, `glass-strong`. Active tab = soft green pill (`bg-brand/12 text-brand rounded-full`). **SVG line icons** (house, map, banknote, person; `stroke: currentColor`, 1.8, 22px) replace emoji. FAB: 50px, brand gradient, `shadow-fab`, `-mt-7`. Content padding-bottom → ~116px. |
| `TopNav` | `glass-strong` + `hairline-b`; height/behavior unchanged. |
| `Card` | `bg-card shadow-card` → `glass` (radius unchanged). |
| `Button` | `primary` → brand gradient + `active:scale-[0.97]` transition; `fill` → translucent (`bg-white/60` + white/60 border + blur). |
| `Input` | `bg-fill` → `bg-white/70` + `border-white/60`; focus ring brand. |
| `Skeleton` | `bg-fill` → `bg-white/50`. |
| `BottomSheet` | `bg-card` → `glass-sheet` (readability for forms), `rounded-t-[26px]`. CheckoutSheet/BoostButton/PlantBottomSheet inherit. |
| Sticky CTAs | ListingDetail buy bar (and any `bg-bg/85 backdrop-blur`) → `glass-strong`. |
| `Badge` | Unchanged (tinted pills already read well on glass). |

**Per-screen touch-ups (raw `bg-card`/`bg-fill` surfaces not using `Card`):** home KPI strip & feed, scan picker rows/chip, My Plan sections, SalesDashboard cards, Marketplace product cards (container → glass; image area untouched), profile comcard & plan row, auth card, public Harvest Passport panels (consumer-facing wow moment). Inner fills sitting ON glass (e.g., summary boxes) become `bg-white/50`.

## Verification

- `npx tsc --noEmit` + `npm run build` green.
- Dev server + `npm run test:smoke -- --app` (pages still render data).
- HTML sanity: SSR output contains `glass`/`glass-strong` on tab bar + cards.
- Final visual judgment: the user pulls the merged PR and reviews live; refinements on request.

## Delivery

Branch `apple-glass-ui` (already created off merged `main`) → draft **PR #3**. Add `.superpowers/` to `.gitignore`. User's folder untouched until they merge.
