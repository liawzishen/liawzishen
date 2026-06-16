# 02 — Prototype → Real App Mapping
> Maps the `greenmap-interactive.html` prototype to the Next.js build.
> ✅ `greenmap-interactive.html` is now in the project (D8 resolved). CSS tokens and tab-bar styling are verified identical to `06` v2. Full screen-by-screen verification happens during Phase 3 frontend work.

---

## 1. Screen Mapping (16 prototype screens)

| # | Prototype Screen | Real Route | MVP or Future | Real Component/Page | Notes |
|---|---|---|---|---|---|
| 1 | Landing | `/` | MVP | `app/page.tsx` (server) | Hero map widget can be a static styled illustration — no live Konva on landing |
| 2 | Register / Login | `/auth` | MVP | `app/auth/page.tsx` + `SegmentedControl`, role cards | Post-login: grower → `/farms`, consumer → `/consumer` |
| 3 | Farm Selector | `/farms` | MVP | `app/farms/page.tsx` + `FarmCard` | Mini-map preview = background thumbnail, not live canvas |
| 4 | Setup · Profile (1/3) | `/farms/new/profile` | MVP | wizard page + `FarmSetupContext` | Grower name never asked — from auth |
| 5 | Setup · Map (2/3) | `/farms/new/map` | MVP | wizard page | Smart Background pre-selected; satellite = pre-captured demo asset |
| 6 | Setup · Zones (3/3) | `/farms/new/zones` | MVP | wizard page + `ZoneChips` | Batch save happens here; max 8 zones |
| 7 | Dashboard (Home) | `/farms/[farmId]` | MVP (staged) | Home page + `KpiCards`, map widget, `PriorityList` | v1 = KPIs + map widget (Phase 4); "Today's Priorities" added in Phase 8 |
| 8 | Plant Detail | `/farms/[farmId]/plants/[plantId]` | MVP | Plant Detail page + plant/* components | Health ring, blue `SuggestionCard`, squarcle quick actions |
| 9 | AI Scan | `/farms/[farmId]/plants/[plantId]/scan` | MVP | scan page + `ScanUploader`, `AIScanResultCard` | Scan-line animation respects `prefers-reduced-motion` |
| 10 | Activity Timeline | `/farms/[farmId]/plants/[plantId]/activity` | MVP | `ActivityTimeline` (full) | Also rendered inline (3–4 recent) on Plant Detail via "View full activity" |
| 11 | Harvest Passport | `/farms/[farmId]/plants/[plantId]/harvest` | MVP | `HarvestPassportCard`, `TrustBadges`, `QrBlock` | "Sell This Harvest" button only if preview screens are built — PREVIEW badge |
| 12 | Consumer QR View | `/passport/[qrToken]` | MVP | public server component | No tab bar, no app chrome; prototype's "Message Farmer" → replaced by WhatsApp share (chat = Phase 3) |
| 13 | Sell This Harvest | — | **Phase 3 preview** | static mockup, Phase 8 optional | Never wired to data |
| 14 | My Sales | `/farms/[farmId]/sales` (tab) | **Phase 3 preview** | static mockup, Phase 8 optional | Sales tab shows this with orange PREVIEW badge |
| 15 | Marketplace (buyer) | — | **Phase 3 preview** | static mockup, Phase 8 optional | |
| 16 | Notifications / Alerts | — | **Phase 2/3 preview** | static mockup, Phase 8 optional | "Today's Priorities" on Home covers the MVP need |

## 2. Screens the App Needs That the Prototype Doesn't Have

| Screen | Route | Why |
|---|---|---|
| Full Farm Map page | `/farms/[farmId]/map` | Prototype's Home shows a map *widget* with "Expand" — this is the expanded working canvas (Map tab) |
| Scan plant picker | `/farms/[farmId]/scan` | The center Scan tab needs a plant context; simple list → per-plant scan route |
| Profile | `/farms/[farmId]/profile` | Profile tab: name, role, farm switcher, logout — kept under the farm so the tab bar keeps context (built Phase 1) |
| Consumer home | `/consumer` | Consumers must land somewhere after login: "scan a QR / enter code" prompt |

## 3. Prototype Component → React Component

| Prototype pattern (`06` §8) | React component |
|---|---|
| Frosted 5-tab bar with raised Scan FAB | `layout/AppShell.tsx` |
| `‹ Back` pushed-page header | `layout/TopNav.tsx` |
| Grouped list (icon tile + title + chevron) | `ui/GroupedList` rows (used by priorities, info, timeline) |
| Horizontal KPI cards | `farm/KpiCards.tsx` |
| Squarcle 4-action grid | `plant/QuickActions.tsx` |
| Health ring card | `plant/HealthScoreCard.tsx` |
| Map widget with health pins | `farm/FarmMap.tsx` (widget mode + full mode) |
| Certificate passport card | `passport/HarvestPassportCard.tsx` |
| Segmented control, pills/badges, inputs | `ui/*` per `06` tokens |

## 4. How to Use the Prototype (and how not to)

Use it as the reference for: page order and flow, layout/spacing, card and button styling, marker visuals, result/passport/QR layouts, and interaction feel. Do **not** copy its HTML/inline styles into the app — rebuild as clean components on the `06` token system. Where the prototype conflicts with the markdown specs, the markdown specs + the Decision Log (`docs/00` §0) win; record any newly discovered conflicts there before coding around them.

Known deltas already decided: zones render as legend/filter chips, not positioned canvas labels (no position data exists in MVP); "Message Farmer" omitted; preview screens are static and badge-marked; **plant markers use the D10 design** — a high-contrast band-colour circle + an always-visible status icon, and a single tap opens a slide-up bottom sheet (exact score, status, quick actions, "View More Details") rather than navigating straight to the detail page.

---

*GreenMap · Prototype Mapping v1 · docs/02 · verify against the HTML file once uploaded (D8)*
