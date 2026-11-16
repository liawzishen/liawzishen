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
Recalculation **writes** only on: water log, fertilize log, scan saved, manual_status change — done by the route that handled the event (`/api/plants/log`, `/api/plants/status`, `/api/tasks/*`, `/api/ai/save-scan`) through `lib/health/recalculate.ts`, which also snapshots to `health_score_history`. Passive decay is computed client-side on Map/Detail load for **display only**. Plant creation triggers **no** recalculation [D4].

## 5. RLS Policies

The browser talks to Supabase directly, so these rules — not the app's code — decide what a signed-in person can do. State after migrations `0010_security_hardening.sql` and `0011_server_writes.sql`; tested by `supabase/tests/`.

| Table | Browser (role `authenticated`) | Server only (service role) |
|---|---|---|
| profiles | SELECT own row; UPDATE own `name` only | plan, scan credits, `is_verified`, role |
| farms, zones, plants, growth_logs | SELECT own. No direct writes since `0011` (with `0010` alone: own rows, minus `health_score`, `lifecycle_status`, back-dating and `ai_scan` / `harvested` logs) | all writes, via the API routes in §7 |
| farm_panoramas, panorama_plant_tags | ALL on own farms' rows; new rows per person are limited (`0011`) | — |
| ai_analyses, health_score_history | SELECT own | all writes |
| harvest_passports | SELECT own. **No public SELECT** — the QR page reads one passport by its token through the server | all writes |
| ai_scan_usage, payments, listing_boosts, listing_stock, rate_limits | SELECT (own, or all for boosts/stock; none for rate_limits) | all writes |
| refund_requests | customer: SELECT/INSERT (`pending` only)/DELETE own. seller: SELECT; UPDATE `status` once, never on their own request. New rows limited | — |
| support_messages | customer: SELECT own, INSERT as `customer`. seller: SELECT and reply in their farm's `seller` threads. New rows limited | the assistant's and auto replies |
| order_feedback | customer: SELECT/INSERT own. seller: SELECT their farm's. New rows limited | — |

"Seller" = the signed-in user owns the farm with the **oldest claim** on the row's farm name (`owns_seller_name()`), because demo listings know their seller only by name. Text columns have length limits (CHECK constraints).

Server-side functions (callable with the service role only): `consume_scan_credit` / `release_scan_credit` (reserve a scan credit atomically, give it back on failure), `add_bonus_scans`, `take_rate_limit`. "New rows limited" is the trigger `limit_client_writes` (`0011`): a fixed number of inserts per person per table in 10 minutes, answered with HTTP 429 beyond that.

## 6. Storage — 3 Public Buckets

`farm-backgrounds` (uploaded aerials) · `plant-scans` (AI scan photos) · `growth-photos` (timeline photos).
Public because images must render on the public QR page. Client compresses to ≤1MB before upload. Path convention: `{farmId}/...` or `{plantId}/{timestamp}.jpg`.
Since `0010`: any signed-in user may upload, but only the **uploader** may replace or delete a file (`owner_id`), and each bucket accepts only JPEG/PNG/WebP up to 10 MB (15 MB for `farm-panoramas`, which `0009` added with per-farm write rules).

## 7. API Routes **[D3 — 5 routes, supersedes the older 4-route set]**

| Route | Does | Writes |
|---|---|---|
| `POST /api/ai/scan` | Gemini Vision call; validate (JSON parse + 1 retry → severity enum → confidence clamp); map severity→sub-score; **returns only** | — |
| `POST /api/ai/save-scan` | grower-confirmed save; re-validate payload | `ai_analyses`, `growth_logs('ai_scan')`, then runs recalculation |
| `POST /api/ai/suggest` | Gemini Text 1–2 sentence suggestion (client session-caches 60 min; never counts as a scan credit) | — |
| `POST /api/farms` | farm + zones in one request, all or nothing (max 25 farms per account) | `farms`, `zones` |
| `POST /api/plants` | add a plant to an own farm (max 2,000 per farm) | `plants`, `growth_logs('planted')` |
| `POST /api/plants/log` | one care event (`water` / `fertilize` / `note`); the server builds `metadata` from typed fields, then recalculates | `growth_logs`, `plants.health_score`, `health_score_history` |
| `POST /api/plants/status` | the grower's own status, then recalculates | `plants.manual_status`, `plants.health_score`, `health_score_history` |
| `POST /api/passports/generate` | aggregates + badges + `qr_token` | `harvest_passports`, `growth_logs('harvested')`, `plants.lifecycle_status='harvested'` |
| `POST /api/mapbox/satellite` *(optional stretch)* | address → static image URL (token server-side). Demo uses a pre-captured asset in `public/demo/` — zero stage dependency | — |

Reads, and writes to the tables the browser may still write (§5), go client → Supabase direct under RLS. (Farms, zones, plants and care logs were written that way too until `0011`; `/api/health/recalculate` existed for that flow and is gone.)

Later routes: `/api/tasks/{complete,uncomplete}`, `/api/payments`, `/api/satellite`, `/api/support/chat`, `/api/listings/stock` (see the README's project structure).

**Rules every route follows** (`guardRequest()` in `lib/api/guard.ts`, helpers in `lib/api/http.ts`):
- In this order: the request must come from the app's own pages (`403` for another site), somebody must be signed in (`401`), they must be under the route's rate limit (`429` + `Retry-After`), and the body must be a JSON object under 100 KB (`400`). Ids must be UUIDs.
- `/api/ai/scan` returns a signed `receipt` with its result; `/api/ai/save-scan` stores a result only if it still matches that receipt (`lib/ai/receipt.ts`). Saving the same scan twice stores it once.
- A scan credit is reserved before the AI call and released if the scan fails (`lib/billing/credits.ts`).
- `imageUrl` in `/api/ai/scan` and `/api/ai/save-scan` must be a file in this project's `plant-scans` bucket (`lib/storage/public-url.ts`). The server downloads that image, so any other URL is rejected with `400`. Images over 8 MB or with a non-image content type are not analysed.
- Free-text inputs are length-capped (chat message 2,000 characters; diagnosis 400; each recommendation 200). Batch routes accept at most 1,000 plant ids.
- Database and upstream errors are logged on the server. The browser only gets a short, safe message.
- A scan reply with an unknown severity is treated as a failed analysis, never as "healthy".
- Harvest dates use the Malaysian calendar day (`lib/date.ts`), not the server's UTC day.
*Change vs the locked architecture:* scan saving and passport generation move from client-direct writes to server routes, because `ai_sub_score`, badge booleans, and passport aggregates are **calculated, trust-bearing records** — and the Mapbox route becomes optional since the demo never calls it live.

## 8. Environment Variables

Public: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_APP_URL`.
Server-only: `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, `MAPBOX_ACCESS_TOKEN` (optional).

## 9. Backend Flows (condensed)

1. **Auth:** signUp with `{name, role}` metadata → trigger creates `profiles` row → middleware redirects grower→`/farms`, consumer→`/consumer`.
2. **Farm setup:** Steps 1–3 in React Context → single batch write on Step 3 (farm insert → zones insert) → navigate to farm.
3. **Add plant:** tap canvas → modal → client inserts plant (`health_score=NULL`, `manual_status='attention'`, `lifecycle_status='active'`, positions 0–1) + `growth_logs('planted')`. No score, no history row [D4].
4. **Log water/fertilize/note:** client POSTs the form fields to `/api/plants/log` → the server checks the plant is the caller's, inserts `growth_logs` with `metadata`, recalculates and returns the score.
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
