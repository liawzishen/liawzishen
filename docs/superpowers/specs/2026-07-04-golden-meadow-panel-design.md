# Login Panel "Golden Meadow" — Design

**Date:** 2026-07-04
**Status:** Approved — user picked option C in the visual companion (sky-composition screen) + "increase the font size".

## Goal

Fill the still-blank sunflower panel with a warm golden-hour landscape, unify the flower colors between register and login, and make the panel typography confident.

## Changes

1. **Color unification (bug-level):** `SunflowerScene.visual()` register-idle branch currently returns muted flowers (`#E9C766`, saturate 0.72, scale 0.9) vs login's vivid `#F6C544`. Register idle now returns the same vivid baseline as login/strength-0 (petals `#F6C544`, saturate 1, brightness 1, scale 1, open 1); the strength-growth arc still applies on top. Idle nodding posture unchanged.
2. **Golden-hour sky:** panel gradient (auth page) `#FFF7DF/#F2FAEE/#E4F2E0` → `#FFEFC2 / #FBF4DC / #EAF2DC`; the scene's fill-mode sky overlay matches (`#FFEFC2 → #FBF4DC → transparent`).
3. **Sun disc** (fill-gated, in scene): ~88px radial glow top-right (`#FFE9A8 → #FFD65E → transparent`, warm outer glow), gentle 6s breathing pulse.
4. **Rolling hills** (fill-gated): two soft wide ellipses behind the grass/flowers (`#d9e3ae` / `#cbdb9c`, opacity ~0.75/0.7) filling the empty middle band.
5. **Clouds stronger:** opacities 0.40/0.32/0.26 → 0.55/0.45/0.35.
6. **Butterfly 🦋** (fill-gated): mid-sky right side, gentle 9s flutter loop, alongside the existing bee.
7. **Bigger panel type (user: "increase the font size"):** brand `🌿 GreenMap` 15→17px; tagline 14→19px semibold (two-line hero statement).
8. All new motion honors the existing `prefers-reduced-motion` kill-switch.

## Verification

CDP-emulated screenshots before delivery: register desktop 1280 + phone 430, plus **login desktop** (clicked via the mode switch) to prove flower colors now match register. No horizontal overflow. `tsc` + production build. Ship as a PR off `main`.
