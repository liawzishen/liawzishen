---
name: greenmap-data-ai-logic
description: >
  Expert reviewer and generator for GreenMap's data and AI logic layer.
  Use this skill whenever the user asks about GreenMap's health score formula,
  Gemini Vision scan flow, Gemini Text suggestion logic, Supabase table design,
  event_type enums, passive decay handling, health score snapshots, AI output
  validation, or MVP vs Phase 2 AI feature decisions. Also trigger when the
  user wants to review, improve, or regenerate the data/AI logic in 03_BACKEND_TRUTH.md,
  or when they ask about any data flow between plants, growth_logs, ai_analyses,
  harvest_passports, or health_score_history tables. Trigger on casual phrases
  too — "does the health score make sense", "is my AI logic right",
  "check my data flow", "update the data doc", or "review my AI logic file".
---

# GreenMap — Data & AI Logic Skill

You are the expert on GreenMap's data and AI logic layer. GreenMap is an
AI-powered plant digital twin and harvest transparency platform for Malaysian
smallholder farmers, built as a hackathon MVP (Codex Community Hackathon KL 2026).

When this skill triggers, your job is one of three things:
1. **Review** the data/AI logic in `docs/03_BACKEND_TRUTH.md` (or the code itself)
2. **Generate** a new or improved version of that file
3. **Answer questions** about specific data or AI logic decisions

Read the relevant project files before doing anything else.

---

## Step 1 — Read the project files

Always read these first. They are the source of truth (the app is built, so **code wins** over any doc).

| Source (in `greenmap/`) | What to check |
|---|---|
| `lib/health/calculate.ts` | **The real formula** — weights, decay rates, defaults (authoritative) |
| `lib/passport/aggregate.ts` + `types/database.ts` | Real passport + table fields |
| `app/api/ai/*` · `app/api/health/recalculate` | Actual scan / suggest / save-scan / recalc routes |
| `docs/03_BACKEND_TRUTH.md` | Canonical backend doc (schema, AI touchpoints, health formula) |
| `docs/01_CODE_CONCEPT.md` | Data model, tech stack, MVP scope, where logic lives |
| `docs/02_PROTOTYPE_MAPPING.md` | Page-level UI the AI logic must support |

The 5-free-scan tier / GreenPoints are **future-scope** (not enforced in the build) — see the `greenmap-business-strategist` skill.

---

## Step 2 — Understand the GreenMap AI system

GreenMap has exactly **three AI touchpoints**. Everything else is deterministic CRUD.

### Touchpoint 1 — Gemini Vision Scan
- **Trigger:** Grower uploads a plant photo, reviews result, taps "Save to Plant Record"
- **Input:** Plant photo + crop type in prompt
- **Output:** JSON — `{ diagnosis, severity, confidence, recommendations }`
- **Severity enum:** `"none"` | `"mild"` | `"moderate"` | `"severe"` — nothing else is valid
- **Sub-score mapping (fixed midpoints):**
  - none → 95, mild → 75, moderate → 50, severe → 20, no scan yet → 50
- **Validation required before save:** JSON parse check, severity enum check, confidence clamp 0–100
- **Save is grower-confirmed, not automatic** — "Save to Plant Record" vs "Scan Again"
- **Side effects after save:** health score recalculates, health_score_history row written, growth_logs entry with `event_type: "ai_scan"`

### Touchpoint 2 — Gemini Text Suggestion
- **Trigger:** Grower opens Plant Detail page
- **Input:** crop type, days since planted, days since last watered, days since last fertilized, last scan diagnosis + severity, current health score
- **Output:** Plain text, 1–2 sentences, one actionable suggestion
- **Storage:** NOT stored in MVP. Session-cached (60-min window per plant) to avoid unbounded API calls
- **Phase 2:** Add weather context (Open-Meteo, keyed to Malaysian state), store in `suggestions` table
- **Credit rule:** This is a Gemini Text call — it does NOT count against the grower's AI scan credits. Scan credits only apply to Gemini Vision calls.

### Touchpoint 3 — Health Score Engine
- **Not a Gemini call.** Pure deterministic formula.
- **Formula:**
  ```
  healthScore =
    (aiSubScore         × 0.40) +
    (wateringSubScore   × 0.25) +
    (fertilizerSubScore × 0.20) +
    (manualSubScore     × 0.15)
  ```
- **AI sub-score:** from latest `ai_analyses.ai_sub_score` — default 50 if no scan
- **Watering sub-score:** `max(0, 100 - daysSinceWatering × 10)` — default 0 if never logged
- **Fertilizer sub-score:** `max(0, 100 - daysSinceFertilizing × 8)` — default 0 if never logged
- **Manual override:** Healthy=100, Attention=50, Critical=0 — default Attention on creation
- **Recalculation triggers:** water log saved, fertilize log saved, AI scan saved, manual status changed
- **Passive decay:** recalculate on page load for display only — do NOT save unless an explicit event fired

---

## Step 3 — Know the critical data structures

### `growth_logs` — canonical event_type values
Only these six strings are valid. Inconsistent strings silently break sub-score queries.

| event_type | When written |
|---|---|
| `"planted"` | Plant added to farm |
| `"water"` | Grower logs watering |
| `"fertilize"` | Grower logs fertilizer |
| `"ai_scan"` | Auto-written when AI scan is saved |
| `"note"` | Grower adds free-text note |
| `"harvested"` | Plant marked as harvested |

### `ai_analyses` — authoritative field list
Per `types/database.ts`:

`id, plant_id, image_url, diagnosis, confidence (int, clamped 0–100), severity (validated enum), ai_sub_score (int 0–100), recommendations (string[]), created_at`

(Earlier summary docs omitted `severity` and `ai_sub_score`; the code includes both — treat the code as truth.)

### `health_score_history` — required for trend chart
The Plant Detail page shows a 7-day health trend chart. `plants.health_score` is a single overwritten number — it has no history. Every time health score saves, also write a row here:

`id, plant_id, score (int), created_at`

Query for chart: `WHERE plant_id = X AND created_at >= NOW() - INTERVAL '7 days' ORDER BY created_at ASC`

### `harvest_passports` — actual fields (see `types/database.ts`)
`id, plant_id, farm_id, harvest_date, grow_days, avg_health, fertilizer_summary (JSONB {types, count}), pesticide_free (boolean), organic (boolean), ai_verified (boolean), ai_scan_count (int), qr_token (UUID), created_at`

The passport stores **badge booleans** (`pesticide_free`, `organic`, `ai_verified`) computed at harvest in `lib/passport/aggregate.ts` — not a raw `pesticide_used` / `fertilizer_count` pair.

---

## Step 4 — What is never AI-generated

These values are always deterministic. Never produced by Gemini.

- Health score number (formula always)
- Trust badges (derived from growth_logs and ai_analyses records)
- Activity timeline (chronological query of growth_logs)
- Grow duration (harvest_date minus plant_date)
- Average health score on Harvest Passport (average of health_score_history)
- QR token (UUID at harvest time)
- Farm stats bar totals (count queries on plants filtered by status)
- AI scan count on Harvest Passport (count of ai_analyses rows)
- Pesticide Free badge (no growth_logs note references pesticide)
- Organic badge (no chemical fertilizer in growth_logs entries)

---

## Step 5 — Review framework (when reviewing an existing file)

Run all 10 checks. Be honest — challenge weak ideas, do not just agree.

1. **Gemini Vision scan flow** — Is save grower-confirmed (not auto)? Is validation present (JSON, enum, clamp)?
2. **Suggestion generator** — Is it session-cached? Is the credit separation from scan credits explicit?
3. **Health score formula** — Are weights correct (40/25/20/15)? Are decay formulas correct? Are defaults correct (AI=50, water=0, fertilize=0, manual=Attention)?
4. **Recalculation triggers** — Are all four events listed? Is passive decay display-only?
5. **Health score history** — Is `health_score_history` table present? Is the write trigger correct?
6. **Supabase table fields** — Does `ai_analyses` have `severity` and `ai_sub_score`? Does `harvest_passports` have `ai_scan_count` and `pesticide_used`? Is `event_type` enum canonical?
7. **AI output validation** — Are the three server-side checks present (JSON parse, severity enum, confidence clamp)?
8. **MVP vs Phase 2 split** — Are weather suggestions, stored suggestions, trend scoring, and fertilizer type weighting correctly in Phase 2?
9. **Business model conflicts** — Is scan credit limit (5 free/month) acknowledged? Is suggestion generator correctly excluded from scan credits?
10. **Page feature conflicts** — Does the data flow support the Plant Detail page (trend chart, AI scan button with credit count), the AI Scan page (review before save), and the Harvest Passport page (trust badges, ai_scan_count, pesticide_used)?

---

## Step 6 — Output format

### When reviewing:
Structure your output in this order:

1. **Overall judgment** — one paragraph, honest assessment
2. **Strong parts** — what is already correct and should not change
3. **Problems found** — numbered list, each with: problem name, what is wrong, why it matters
4. **MVP vs Future correction table** — only features that are misplaced
5. **Data flow issues** — anything that breaks the chain from grower action to consumer trust
6. **AI logic risks and fixes** — Gemini failure modes and how to handle them
7. **Exact edits by section** — reference section numbers, show before/after only for changed text
8. **Improved sections only** — do not rewrite sections that are already correct

### When generating a new file:
Follow this structure (matching `docs/03_BACKEND_TRUTH.md`):
- Section 1: Overview (3-touchpoint table)
- Section 2: Gemini Vision Scan (full flow including validation and grower confirmation)
- Section 3: Gemini Text Suggestion (session cache, credit separation, Phase 2 weather)
- Section 4: Health Score Engine (formula, all four sub-scores, recalculation triggers, snapshot)
- Section 5: What is never AI-generated
- Section 6: Full data flow chain
- Section 7: Supabase tables (all five tables with full field lists and event_type enum)
- Section 8: Phase roadmap (MVP now vs Phase 2)

Write to `greenmap/docs/03_BACKEND_TRUTH.md` (the canonical backend doc — there is no separate `03_GreenMap_Data_AI_Logic.md` in the repo). Prefer reflecting what the code actually does.

---

## Key constraints — always respect these

- **Hackathon MVP scope.** No IoT, no real-time monitoring, no weather in health score, no complex analytics.
- **Malaysian farmers context.** Language in suggestions should be plain and direct. No farming jargon.
- **Free tier only.** Gemini Vision API (Google AI Studio free tier), Supabase free tier, Vercel free tier.
- **No auto-save of scan results.** The grower always reviews before saving. This is a UI contract from `docs/02_PROTOTYPE_MAPPING.md` and the `app/api/ai/save-scan` route.
- **Health score is deterministic.** Never let Gemini output influence the score formula directly — only through the severity→sub-score mapping.
- **The code is authoritative.** `ai_analyses` includes `severity` and `ai_sub_score`; the passport stores `fertilizer_summary` + `pesticide_free`/`organic`/`ai_verified` badges. If any doc disagrees with `types/database.ts` or `lib/`, trust the code.
