# 03 — GreenMap Backend Truth
> Canonical backend reference for the MVP build · Supersedes the schema fragments in `01` and consolidates `03_Data_AI_Logic` + the locked architecture decisions.
> ⚠️ `05_GreenMap_Technical_Architecture.md` is **not present** in `/mnt/project/` (it was produced in an earlier session but never added). Decision **D7** (approved): this file is the working backend truth; the numbered `05` doc can be regenerated from it later if wanted.
> Items tagged **[D3] [D4] [D5]** amended the previously locked architecture and were **approved 13 Jun 2026** (see `docs/00` §0) — they are now canonical.

---

## 1. Supabase Tables (8)

`profiles · farms · zones · plants · growth_logs · ai_analyses · health_score_history · harvest_passports`
No marketplace, orders, payments, GreenPoints, leaderboard, chat, review, or suggestion tables in MVP.

### `profiles`
| Column | Type | Req | Notes |
|---|---|---|---|
| id | UUID | PK | = `auth.users.id`; auto-created by trigger on signup |
| name | TEXT | ✓ | display name |
| email | TEXT | ✓ | from auth |
| role | TEXT | ✓ | `'grower'` \| `'consumer'` (also in `raw_user_meta_data` for middleware) |
| is_verified | BOOLEAN | ✓ | default `false`; Verified Grower badge; set manually in MVP |
| created_at | TIMESTAMPTZ | auto | |

### `farms`
| Column | Type | Req | Notes |
|---|---|---|---|
| id | UUID | PK | |
| user_id | UUID | FK→profiles | owner |
| name / location / size / crop_type | TEXT | ✓ | size: `'small'|'medium'|'large'`; location: Malaysian state |
| background_type | TEXT | ✓ | `'smart'|'upload'|'satellite'` (smart = default) |
| background_url | TEXT | – | null for smart |
| canvas_width / canvas_height | INT | ✓ | default 1200×800 (one fixed aspect per farm) |
| created_at | TIMESTAMPTZ | auto | |

### `zones`
`id · farm_id FK · name · color · created_at` — label + color only. **No coordinates, no polygons.** Zones attach to plants via `plants.zone_id`; UI renders them as legend/filter chips, not positioned canvas labels.

### `plants`
| Column | Type | Req | Notes |
|---|---|---|---|
| id | UUID | PK | |
| farm_id | UUID | FK | |
| zone_id | UUID | FK, nullable | zone optional |
| name / type | TEXT | ✓ | |
| plant_date | DATE | ✓ | default today on creation |
| expected_harvest_date | DATE | – | optional input in Add Plant modal; drives "Harvest Ready" |
| position_x / position_y | FLOAT | ✓ | **0.0–1.0 percentages** of canvas, never pixels |
| health_score | INT | **nullable [D4]** | NULL at creation → grey "New" marker; first recalculation sets it. (Replaces old "default ≈35", which wrongly rendered new plants red) |
| manual_status | TEXT | ✓ **[D5]** | `'healthy'|'attention'|'critical'` — grower-set health input; default `'attention'` |
| lifecycle_status | TEXT | ✓ **[D5]** | `'active'|'harvested'` — default `'active'`. (Replaces single `status` that mixed both concerns) |
| created_at | TIMESTAMPTZ | auto | |

### `growth_logs`
`id · plant_id FK · event_type · note · photo_url · metadata JSONB · created_at`

**Canonical `event_type` enum — exactly these six strings everywhere:**
`'planted' · 'water' · 'fertilize' · 'ai_scan' · 'note' · 'harvested'`

**`metadata` examples:**
- fertilize → `{ "fertilizer_type": "NPK 15-15-15", "fertilizer_category": "chemical|organic|unknown", "amount": "50g", "pesticide_used": false }`
- note → `{ "pesticide_used": true, "pesticide_type": "Neem oil spray" }`
- ai_scan → `{ "diagnosis": "...", "severity": "moderate", "confidence": 86 }`
- water → `{ "method": "drip" }` (optional)

Badges read **structured metadata**, never free-text notes. The log modals must therefore always offer: fertilizer category select (fertilize) and a pesticide checkbox (fertilize + note).

### `ai_analyses`
`id · plant_id FK · image_url · diagnosis · confidence INT (clamped 0–100) · severity ('none'|'mild'|'moderate'|'severe') · ai_sub_score INT · recommendations JSONB (2–4 strings) · created_at`
> `severity` + `ai_sub_score` are missing from `01`'s data model — this list is authoritative.

### `health_score_history`
`id · plant_id FK · score INT 0–100 · created_at` — one row inserted on **every** `plants.health_score` update. Index `(plant_id, created_at)`. Trend query: last 7 days ordered ASC.

### `harvest_passports`
`id · plant_id FK · farm_id FK · harvest_date · grow_days INT · avg_health INT · fertilizer_summary JSONB {types[],count} · pesticide_free BOOL · organic BOOL · ai_verified BOOL · ai_scan_count INT · qr_token UUID UNIQUE · created_at`
Frozen snapshot — never recalculated after generation. Verified Grower badge is **not** stored; read live from owner's `profiles.is_verified` at render.

## 2. Relationships

```
profiles 1─* farms 1─* zones
                  1─* plants 1─* growth_logs / ai_analyses / health_score_history
                              1─(0..1) harvest_passports
```
Access control flows down `farms.user_id`.

## 3. Enums & Mappings (single source)

| Set | Values |
|---|---|
| event_type | planted, water, fertilize, ai_scan, note, harvested |
| severity | none, mild, moderate, severe |
| severity → ai_sub_score | none 95 · mild 75 · moderate 50 · severe 20 · no scan default 50 |
| manual_status → sub-score | healthy 100 · attention 50 · critical 0 |
| score band → marker | 70–100 green · 40–69 amber · 0–39 red · NULL grey "New" |
| background_type | smart, upload, satellite |
| Harvest Ready | `lifecycle_status='active'` AND `expected_harvest_date ≤ today` (NULL = never ready) |

## 4. Health Score Engine

```
score = round(ai×0.40 + watering×0.25 + fertilizer×0.20 + manual×0.15)
watering   = max(0, 100 − daysSinceWater×10)      (never watered → 0)
fertilizer = max(0, 100 − daysSinceFertilize×8)   (never fertilized → 0)
```
Recalculation **writes** only on: water log, fertilize log, scan saved, manual_status change — via `/api/health/recalculate`, which also snapshots to `health_score_history`. Passive decay is computed client-side on Map/Detail load for **display only**. Plant creation triggers **no** recalculation [D4].

## 5. RLS Policies

| Table | Policy |
|---|---|
| profiles | SELECT/UPDATE own row (`auth.uid() = id`) |
| farms | ALL where `auth.uid() = user_id` |
| zones, plants | ALL where `farm_id IN (own farms)` |
| growth_logs, ai_analyses, health_score_history | ALL where `plant_id IN (plants of own farms)` |
| harvest_passports | ALL for owner (via farm_id) **+ public SELECT** (safe: `qr_token` is unguessable; page fetches by exact token) |

Writes performed by API routes use the **service role key** (bypasses RLS) — that key exists only in server env. [D3] tightening (Phase 2, optional): revoke client INSERT on `ai_analyses`, `health_score_history`, `harvest_passports` so calculated tables are server-write-only.

## 6. Storage — 3 Public Buckets

`farm-backgrounds` (uploaded aerials) · `plant-scans` (AI scan photos) · `growth-photos` (timeline photos).
Public because images must render on the public QR page. Client compresses to ≤1MB before upload. Path convention: `{farmId}/...` or `{plantId}/{timestamp}.jpg`.

## 7. API Routes **[D3 — 5 routes, supersedes the older 4-route set]**

| Route | Does | Writes |
|---|---|---|
| `POST /api/ai/scan` | Gemini Vision call; validate (JSON parse + 1 retry → severity enum → confidence clamp); map severity→sub-score; **returns only** | — |
| `POST /api/ai/save-scan` | grower-confirmed save; re-validate payload | `ai_analyses`, `growth_logs('ai_scan')`, then runs recalculation |
| `POST /api/ai/suggest` | Gemini Text 1–2 sentence suggestion (client session-caches 60 min; never counts as a scan credit) | — |
| `POST /api/health/recalculate` | fetch inputs → formula → save | `plants.health_score`, `health_score_history` |
| `POST /api/passports/generate` | aggregates + badges + `qr_token` | `harvest_passports`, `growth_logs('harvested')`, `plants.lifecycle_status='harvested'` |
| `POST /api/mapbox/satellite` *(optional stretch)* | address → static image URL (token server-side). Demo uses a pre-captured asset in `public/demo/` — zero stage dependency | — |

Everything else (farms, zones, plants, water/fertilize/note logs, reads) = client → Supabase direct under RLS.
*Change vs the locked architecture:* scan saving and passport generation move from client-direct writes to server routes, because `ai_sub_score`, badge booleans, and passport aggregates are **calculated, trust-bearing records** — and the Mapbox route becomes optional since the demo never calls it live.

## 8. Environment Variables

Public: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_APP_URL`.
Server-only: `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, `MAPBOX_ACCESS_TOKEN` (optional).

## 9. Backend Flows (condensed)

1. **Auth:** signUp with `{name, role}` metadata → trigger creates `profiles` row → middleware redirects grower→`/farms`, consumer→`/consumer`.
2. **Farm setup:** Steps 1–3 in React Context → single batch write on Step 3 (farm insert → zones insert) → navigate to farm.
3. **Add plant:** tap canvas → modal → client inserts plant (`health_score=NULL`, `manual_status='attention'`, `lifecycle_status='active'`, positions 0–1) + `growth_logs('planted')`. No score, no history row [D4].
4. **Log water/fertilize/note:** photo→Storage if any → client inserts `growth_logs` with `metadata` → calls `/api/health/recalculate`.
5. **AI scan:** §7 scan→review→save-scan chain.
6. **Recalculate:** route fetches latest sub-score inputs → formula → update + snapshot → returns score.
7. **Harvest:** confirm modal → `/api/passports/generate` → passport page.
8. **Consumer QR:** `/passport/[qrToken]` server component, **public, no login** → service-role fetch: passport by token + joins (plant, farm, profile) + logs + analyses → renders story, badges, timeline. Invalid token → friendly 404.

## 10. MVP vs Future Backend

| MVP | Phase 2 | Phase 3 |
|---|---|---|
| 8 tables, 5 routes, 3 buckets above | `suggestions` table; weather input (Open-Meteo); scan-credit enforcement; calculated-table write lockdown; farm editing; rolling scan average; confidence-weighted sub-scores | marketplace/orders/payments/points/leaderboard/review/chat tables; ads; B2B data |

## 11. Seed Script Spec (`scripts/seed-demo.ts`)

Demo grower **Ahmad** (verified=true) · farm **Ladang Hijau**, Johor, Tomato, satellite background from `public/demo/` · ~30 plants spread across the canvas (mostly healthy, 2 attention, 1 critical, 1 harvest-ready, 1 brand-new grey) · backdated water/fertilize logs with proper `metadata` · 7 days of `health_score_history` for "Tomato A" (~92%) · 2–3 `ai_analyses` · **one harvested plant with passport + fixed `qr_token`** for a printable QR. Idempotent: wipe-and-reseed by demo user id.

---

*GreenMap · Backend Truth v1 · docs/03 · amendments D3/D4/D5 approved 13 Jun 2026*
