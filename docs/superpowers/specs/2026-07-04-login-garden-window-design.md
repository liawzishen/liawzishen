# Login "Garden Window" Redesign — Design

**Date:** 2026-07-04
**Status:** Approved via user-supplied reference image (WhatsApp Image 2026-07-04 at 2.02.33 AM: split login card — mascot illustration left panel, clean form right panel, switch link pinned at the panel bottom). Iterated in the visual companion: Garden window (A) → form inside the panel → reference layout.

## Goal

Replace the two loose columns (PR #6) with **one rounded container** split in two, mirroring the reference:

- **Left (garden half):** warm sky gradient (`#FFF7DF → #F2FAEE → #E4F2E0`), brand `🌿 GreenMap` + tagline "Grow trust, from seed to sale." top-left, the interactive `SunflowerScene` rooted at the panel's bottom (mascot position). The scene's own sky overlay uses the same colors, so it blends seamlessly.
- **Right (form half):** `bg-white/85 backdrop-blur-xl`, centered small 🌿 mark, title ("Welcome back!" / "Create your account"), subtitle ("Please enter your details." for login; existing register copy), the existing SegmentedControl + form **unchanged**, and the mode-switch line moved **inside** the panel, pinned to its bottom on desktop (`md:mt-auto`).

## Behavior

- Container: `max-w-[880px]`, `rounded-[26px] glass overflow-hidden`, `md:grid-cols-[1.05fr_1fr]`, `md:min-h-[560px]` on the form half (garden stretches to match).
- **Phones (<md):** same container stacks — garden banner (brand + flowers, `min-h-[240px]`) on top, form below. No feature/logic changes anywhere; `SunflowerScene` untouched (its flowers auto-scale with container height).
- Old standalone brand block and outside-footer are removed (both now live inside the container).

## Verification & delivery

`tsc` + `npm run build`; dev-server fetch of `/auth` asserting the new container classes + "Welcome back!" render. Branch `login-garden-window` → PR #7. Implementation is a single-file edit of `greenmap/app/auth/page.tsx` (three block edits: opening layout, footer relocation, closing tags) — the plan is folded into this spec given the one-file scope.
