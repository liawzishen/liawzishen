# Premium Auth (Apple-aesthetic) — Design

**Date:** 2026-07-05
**Status:** Approved — user's detailed spec + visual-companion decision **B (disabled SSO previews)**; my two accepted amendments: keep the brand-gradient CTA (not flat #56C271), and SSO buttons are half-width side-by-side so the fixed-height card fits without internal scroll.

## Left panel (shared, both modes)

- Split becomes **50/50** (was 45/55); card stays fixed-size (now `sm:h-[820px]` to absorb the SSO block), rounded 26px, max-w 880.
- Gradient tuned cream → **soft mint**: `#FFEFC2 → #F8F4DC → #DFF2E4`.
- The top-left brand block is replaced by a **centered frosted-glass card** (`glass`, rounded 20px, centered both axes on sm+; top-centered on phones so it clears the flowers): 🌿 **GreenMap** header + tagline “Empowering Farms & Connecting Tables.” in high-contrast `#2c3a30`.
- Floating life: existing butterfly + bee, plus a **gently bobbing leaf 🍃** (new `sf-leaf` keyframes; frozen under reduced-motion). Sunflowers stay planted at the base; sun cursor unchanged.

## Right panel shared

- Local `Field` inputs go premium: **52px tall, `#F5F5F7`, rounded 12px, no border** (error keeps the red ring); labels stay small uppercase; eye toggle unchanged.
- **OR divider + disabled SSO previews (decision B):** hairline divider with centered OR; below, two **half-width** buttons side by side — Apple (solid black, white Apple glyph) and Google (white, thin gray border, colorful G) — `disabled`, `cursor-not-allowed`, ~55–70% opacity, with a centered caption “Sign in/up with Apple or Google — coming soon”. No click handlers.
- Footer link pinned at the bottom as today. Login’s header+form+SSO block is vertically centered (`sm:my-auto`) so the shorter form balances.

## Register specifics

- Header **“Join GreenMap”**, subtitle **“Map your farm, track crops, build trust.”**
- Role cards → **iOS-widget style**: white, rounded 14px, soft shadow, hairline border; selected = light-green border + faint green tint + a green ✓ bubble in the top-right corner.
- The static password-hint paragraph is replaced by **`PasswordChecklist` gaining a `compact` prop**: the existing 5-segment strength bar + a horizontally wrapping row of mini ✓ chips (8+ chars · Uppercase · Lowercase · Number · Symbol) that **tick live while typing** (logic already exists in `lib/auth/password`).
- Spacing trims so register fits the 820px card with **zero internal scroll** (measured): form `space-y-3`, role cards `p-2.5`, tighter label margins.

## Out of scope / unchanged

Auth logic, Supabase flows, sunflower engine, phone stacked layout (banner + form), the 430px app-frame escape.

## Verification

CDP screenshots: login desktop, register desktop (both must measure the same card size with `formScroll: 0`), register phone; visual pass on the glass brand card, SSO row, checklist chips. `tsc` + production build. Ship as one PR.
