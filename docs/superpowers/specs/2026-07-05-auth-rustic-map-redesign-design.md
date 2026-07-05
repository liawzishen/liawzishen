# Auth Rustic Map Redesign — Design

**Date:** 2026-07-05
**Scope:** `/auth` (login + register toggle) only
**Status:** Approved (user, 2026-07-05)

## Goal

Re-skin the single `/auth` page from the "Liquid Glass" look into the rustic
farm-adventure-map aesthetic (parchment scroll form, wooden GreenMap signboard,
topographic map background, cottage, scattered garden props, bees/butterflies)
shown in the user's three reference images — **while keeping all real auth logic
and the existing interactive sunflower + sun-cursor animation intact.**

This is a **presentation-layer change**. Supabase calls, validation, the
3-strike login lockout, the email-confirmation notice, the mode toggle, and the
password rules are unchanged. Only markup, styling, fonts, and decorative
scenery change. Everything is scoped to `/auth`; no other screen changes.

## Approved decisions

1. **Theme scope:** login + register only. Rustic tokens are added *additively*
   to `globals.css` (no existing token changed) and only *used* under the auth
   layout, so the glass screens are unaffected.
2. **Animation:** keep the existing interactive `SunflowerScene` — mouse = glowing
   sun, flowers bend to track it (heliotropism), grow with password strength,
   wilt after failed logins. Not the prototype's simpler sway.
3. **Layout:** full illustrated map scene (topo map, cottage, wooden signboard,
   floating parchment scroll form, planted sunflowers, scattered props + insects).
4. **Fields:** keep the current set — Grower/Consumer role, Full Name, Email,
   Password (+ live 5-rule checklist), Confirm Password. Real Supabase auth.
   SSO buttons wood-styled but honestly disabled ("coming soon"). No demo bypass,
   no Farm Name field.
5. **Backdrop (judgment call, accepted):** one unified parchment topographic-map
   backdrop for **both** modes (not picture 3's separate blue-sky landscape panel).

## Key implementation choices

- **No new npm dependencies.** The prototype's `framer-motion` effects (butterfly,
  bee, chimney smoke, sway) are reimplemented with CSS keyframes, consistent with
  how `SunflowerScene` already animates.
- **Reuse, don't rewrite:** extend `SunflowerScene` with a `blend` prop so it sits
  on the parchment (suppress its own full sky/clouds/emoji insects; keep grass,
  flowers, sun cursor, particles). Reuse `PasswordChecklist` (restyle the `compact`
  branch only — the non-compact branch is used by the glass Profile screen and must
  stay unchanged) and `lib/auth/password.ts` unchanged.
- **Rustic font:** Fredoka loaded via `next/font/google` in a new `app/auth/layout.tsx`,
  exposed as `--font-fredoka` and referenced by a `font-rustic` utility. Scoped to
  the auth subtree.
- **Cursor:** the form card is a sibling *above* the scene (not inside its
  `cursor-none` region), so inputs keep a normal caret while the map shows the sun.

## Files

**New**
- `app/auth/layout.tsx` — Fredoka font + `.auth-rustic` wrapper (keeps `.auth-breakout`
  full-bleed behavior; `.app-frame:has(.auth-breakout)` still matches through the wrapper).
- `components/auth/map/TopoBackground.tsx` — parchment map background (grid, contours,
  dashed trails, concentric rings, compass "N"), optional cursor parallax, reduced-motion safe.
- `components/auth/map/SceneProps.tsx` — `WoodenSign`, `CottageIllust`, `SeedPacket`,
  `GardeningTools`, `Butterfly`, `Bumblebee` (CSS-animated).

**Edited**
- `app/auth/page.tsx` — new scene markup + rustic classes; **auth logic unchanged**.
- `components/auth/SunflowerScene.tsx` — add `blend` prop.
- `components/auth/PasswordChecklist.tsx` — rustic restyle of the `compact` branch only.
- `app/globals.css` — additive rustic tokens + utilities (`parchment-shadow`,
  `wood-btn-shadow`, `wood-border`, `wood-border-sm`, `topo-grid`, `--font-rustic`).

## Layout

**Desktop:** full-bleed scene via `.auth-breakout`. TopoBackground behind; cottage
top-left; wooden GreenMap signboard center-left; interactive sunflowers planted along
the base; scattered seed packets + tools + drifting insects; parchment scroll form
card on the right with heading swapping "Welcome back!" / "Join GreenMap".

**Mobile:** single stacked column — signboard top, parchment form, sunflowers anchored
bottom corner with a butterfly. Sun interaction uses the gyroscope + tap flares already
in `SunflowerScene`.

## Preserved (no-touch)

Supabase `signUp`/`signInWithPassword`, role metadata + `destinationFor` routing,
email-confirmation notice path, 3-strike login lockout + wilt, all validation /
`canSubmit` gating, disabled-SSO honesty, reduced-motion handling, the shared
`Button`/glass system used by the rest of the app, and the non-compact
`PasswordChecklist` used by Profile.

## Risks / mitigations

- **Cursor-none vs. form usability** → form is a sibling above the scene's cursor-none region.
- **Readability on parchment** → wood-dark text on paper-light stays high-contrast.
- **Token leakage** → rustic classes used only under the auth layout; tokens additive.

## Build order

1. Tokens/utilities + Fredoka layout
2. `TopoBackground`
3. `SceneProps`
4. `SunflowerScene` `blend` prop
5. `page.tsx` scene rebuild
6. `PasswordChecklist` compact restyle
7. Verify: desktop + mobile, both modes, reduced-motion, auth still works.
