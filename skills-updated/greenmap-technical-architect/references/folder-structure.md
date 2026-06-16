# GreenMap Folder Structure

Principle: flat and obvious. Find any file in under 5 seconds.

> This reflects the **built** app (Phases 1–8 complete). The repo root is `greenmap/`.
> Notable since the original plan: the **Map tab is a farms list** that opens the Konva
> canvas at `…/field`; AI **save** and **passport** are server routes; Home carries the
> **Today's Tasks** board (with `api/tasks/*`).

```
greenmap/
├── app/
│   ├── layout.tsx                       # Root layout, fonts
│   ├── loading.tsx · error.tsx · not-found.tsx
│   ├── page.tsx                         # Landing (server)
│   ├── auth/page.tsx                    # Register / Login + SunflowerScene
│   ├── consumer/page.tsx                # Minimal consumer home
│   ├── farms/
│   │   ├── page.tsx                     # Farm selector
│   │   ├── new/
│   │   │   ├── layout.tsx
│   │   │   ├── profile/page.tsx         # Setup step 1
│   │   │   ├── map/page.tsx             # Setup step 2 (background)
│   │   │   └── zones/page.tsx           # Setup step 3 (batch save)
│   │   └── [farmId]/
│   │       ├── page.tsx                 # HOME — Quick Stats + Today's Tasks
│   │       ├── map/page.tsx             # Map tab → farms LIST
│   │       ├── field/page.tsx           # KPI strip + Konva farm map
│   │       ├── scan/page.tsx            # Scan plant-picker tab
│   │       ├── sales/page.tsx           # Sales (preview) tab
│   │       ├── profile/page.tsx         # Profile tab
│   │       └── plants/[plantId]/
│   │           ├── page.tsx             # Plant Detail
│   │           ├── scan/page.tsx        # AI Scan
│   │           ├── activity/page.tsx    # Full activity timeline
│   │           └── harvest/page.tsx     # Harvest → Passport
│   ├── passport/[qrToken]/page.tsx      # Consumer QR view (server, public)
│   └── api/
│       ├── ai/{scan,save-scan,suggest}/route.ts
│       ├── health/recalculate/route.ts
│       ├── passports/generate/route.ts
│       └── tasks/{complete,uncomplete}/route.ts
│
├── components/
│   ├── ui/            # Button, Card, Badge, Input, Select, BottomSheet, SegmentedControl, EmptyState, Skeleton
│   ├── layout/        # AppShell (tab bar), TopNav, StepDots
│   ├── auth/          # SunflowerScene, PasswordChecklist, SignOutButton
│   ├── farm/          # FarmMap, FarmMapCanvas, PlantMarker, PlantBottomSheet, KpiStrip, AddPlantModal, LogModal, FarmCard
│   ├── home/          # TodaysTasks (accordion + batch + Completed Today)
│   ├── dashboard/     # FarmDashboard
│   ├── plant/         # HealthTrendChart, ActivityTimeline, SuggestionCard, ManualStatusControl, PlantQuickActions
│   └── passport/      # HarvestPassportCard, TrustBadges, QrBlock, HarvestConfirm
│
├── lib/
│   ├── supabase/      # client.ts · server.ts · admin.ts (service role) · middleware.ts
│   ├── ai/            # gemini-vision.ts · gemini-text.ts · validate.ts (REST, no SDK)
│   ├── health/        # calculate.ts (pure) · live.ts (display decay) · recalculate.ts (shared write) · display.ts (bands)
│   ├── passport/      # aggregate.ts (pure)
│   ├── auth/          # password.ts (rules)
│   └── utils.ts
│
├── contexts/
│   └── farm-setup-context.tsx           # Setup data across steps 1–3
│
├── types/             # database.ts (schema mirror) · index.ts
├── docs/              # 00_BUILD_PLAN · 01_CODE_CONCEPT · 02_PROTOTYPE_MAPPING · 03_BACKEND_TRUTH · 08_DEMO
├── supabase/migrations/   # 0001_init … 0004_storage
├── scripts/           # seed-demo.ts · test-tasks-data.sql · README.md
├── middleware.ts      # Auth redirect + role routing
├── .env.local         # Secrets (gitignored)
└── package.json
```

## Conventions
- One component per file. No barrel exports unless 5+ components.
- Types in one file until it exceeds ~200 lines.
- No `src/` directory. App Router at root.
- `lib/` = logic, `components/` = UI, `contexts/` = state.
- There is **no** `contexts/auth-context.tsx` — auth/session is read via the Supabase clients + `middleware.ts`.
