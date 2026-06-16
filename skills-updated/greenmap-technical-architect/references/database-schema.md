# GreenMap MVP Database Schema

## Table Relationships (Simple Language)

```
profiles (1) ──→ farms (many)        A grower owns many farms
farms (1)    ──→ zones (many)        A farm has many zones (optional)
farms (1)    ──→ plants (many)       A farm has many plants
zones (1)    ──→ plants (many)       A zone contains many plants (optional link)
plants (1)   ──→ growth_logs (many)  A plant has many activity logs
plants (1)   ──→ ai_analyses (many)  A plant has many AI scan results
plants (1)   ──→ health_score_history (many)  A plant has many score snapshots
plants (1)   ──→ harvest_passports (0 or 1)   A plant has at most one passport
```

Every table links back to the grower through the `farms.user_id` chain. This is how RLS works — access control flows from profiles → farms → everything else.

---

## Table Definitions

### `profiles`
| Column | Type | Required | Notes |
|---|---|---|---|
| id | UUID | PK | FK to `auth.users.id`, set on registration |
| name | TEXT | Yes | Grower or consumer display name |
| email | TEXT | Yes | From auth |
| role | TEXT | Yes | `'grower'` or `'consumer'` |
| is_verified | BOOLEAN | Yes | Default `false`. Used for Verified Grower badge |
| created_at | TIMESTAMPTZ | Auto | Default `now()` |

Auto-create via database trigger on `auth.users` insert. Role also stored in `auth.users.raw_user_meta_data` for middleware reads.

### `farms`
| Column | Type | Required | Notes |
|---|---|---|---|
| id | UUID | PK | Default `gen_random_uuid()` |
| user_id | UUID | FK | References `profiles.id` |
| name | TEXT | Yes | Farm display name |
| location | TEXT | Yes | Malaysian state name |
| size | TEXT | Yes | `'small'`, `'medium'`, `'large'` |
| crop_type | TEXT | Yes | Main crop |
| background_type | TEXT | Yes | `'smart'`, `'upload'`, `'satellite'` |
| background_url | TEXT | No | URL for upload/satellite. Null for smart background |
| canvas_width | INT | Yes | Default 1200 |
| canvas_height | INT | Yes | Default 800 |
| created_at | TIMESTAMPTZ | Auto | Default `now()` |

### `zones`
| Column | Type | Required | Notes |
|---|---|---|---|
| id | UUID | PK | Default `gen_random_uuid()` |
| farm_id | UUID | FK | References `farms.id` |
| name | TEXT | Yes | Zone label, e.g. "Tomato Rows" |
| color | TEXT | Yes | Hex color or preset name |
| created_at | TIMESTAMPTZ | Auto | Default `now()` |

Dead simple — no coordinates, no polygons. Just a label and color assigned to plants.

### `plants`
| Column | Type | Required | Notes |
|---|---|---|---|
| id | UUID | PK | Default `gen_random_uuid()` |
| farm_id | UUID | FK | References `farms.id` |
| zone_id | UUID | FK | References `zones.id`. **Nullable** — zone is optional |
| name | TEXT | Yes | e.g. "Tomato A" |
| type | TEXT | Yes | Crop type |
| plant_date | DATE | Yes | When planted |
| expected_harvest_date | DATE | No | Nullable |
| position_x | FLOAT | Yes | 0.0–1.0 percentage of canvas width |
| position_y | FLOAT | Yes | 0.0–1.0 percentage of canvas height |
| health_score | INT | **No (nullable)** | 0–100. **NULL = grey "New" marker (D4)**; updated only on explicit scoring actions |
| manual_status | TEXT | Yes | `'healthy'` / `'attention'` / `'critical'` (grower-set) — D5 |
| lifecycle_status | TEXT | Yes | `'active'` / `'harvested'` — D5 |
| created_at | TIMESTAMPTZ | Auto | Default `now()` |

Default `health_score` on creation: **NULL** (renders the grey "New" pin until the first
scoring event fires — D4). Default `manual_status`: `'attention'`; `lifecycle_status`: `'active'`.
There is **no single `status` column** — it was split into `manual_status` + `lifecycle_status` (D5).

### `growth_logs`
| Column | Type | Required | Notes |
|---|---|---|---|
| id | UUID | PK | Default `gen_random_uuid()` |
| plant_id | UUID | FK | References `plants.id` |
| event_type | TEXT | Yes | See canonical enum below |
| note | TEXT | No | Free text |
| photo_url | TEXT | No | Supabase Storage URL |
| metadata | JSONB | No | Event-specific structured data |
| created_at | TIMESTAMPTZ | Auto | Default `now()` |

#### Canonical `event_type` Enum

Use EXACTLY these values everywhere — queries, inserts, UI mappings:

| event_type | Description | UI Label |
|---|---|---|
| `'planted'` | Plant was added to the farm | "Planted" |
| `'water'` | Grower logged a watering | "Watered" |
| `'fertilize'` | Grower logged fertilizer application | "Fertilized" |
| `'ai_scan'` | AI scan result was saved | "AI Scan" |
| `'note'` | Grower added a free-text note | "Note" |
| `'harvested'` | Plant was marked as harvested | "Harvested" |

UI labels can differ from database values. Database values must never change.

#### Metadata JSONB Examples by Event Type

**water:**
```json
{ "method": "drip" }
```

**fertilize:**
```json
{
  "fertilizer_type": "NPK 15-15-15",
  "fertilizer_category": "chemical",
  "amount": "50g",
  "pesticide_used": false
}
```

`fertilizer_category`: `'organic'` | `'chemical'` | `'unknown'` — used for Organic badge.
`pesticide_used`: boolean — used for Pesticide Free badge. Can also appear on `water` or `note` events if pesticide was applied alongside.

**ai_scan:**
```json
{
  "diagnosis": "Nitrogen Deficiency",
  "severity": "moderate",
  "confidence": 86
}
```

**note:**
```json
{
  "pesticide_used": true,
  "pesticide_type": "Neem oil spray"
}
```

### `ai_analyses`
| Column | Type | Required | Notes |
|---|---|---|---|
| id | UUID | PK | Default `gen_random_uuid()` |
| plant_id | UUID | FK | References `plants.id` |
| image_url | TEXT | Yes | Supabase Storage URL |
| diagnosis | TEXT | Yes | Gemini diagnosis label |
| confidence | INT | Yes | 0–100, clamped before storing |
| severity | TEXT | Yes | `'none'`, `'mild'`, `'moderate'`, `'severe'` |
| ai_sub_score | INT | Yes | Mapped from severity (see below) |
| recommendations | JSONB | Yes | Array of 2–4 strings |
| created_at | TIMESTAMPTZ | Auto | Default `now()` |

> The code (`types/database.ts`) is authoritative for this table: it includes `severity`, `ai_sub_score`, and `recommendations` (string[]).

### `health_score_history`
| Column | Type | Required | Notes |
|---|---|---|---|
| id | UUID | PK | Default `gen_random_uuid()` |
| plant_id | UUID | FK | References `plants.id` |
| score | INT | Yes | 0–100 |
| created_at | TIMESTAMPTZ | Auto | Default `now()` |

Written every time `plants.health_score` is updated. Powers the 7-day trend chart (a dependency-free inline SVG — Recharts is not used).

Query for trend chart:
```sql
SELECT score, created_at
FROM health_score_history
WHERE plant_id = [id]
  AND created_at >= NOW() - INTERVAL '7 days'
ORDER BY created_at ASC
```

### `harvest_passports`
| Column | Type | Required | Notes |
|---|---|---|---|
| id | UUID | PK | Default `gen_random_uuid()` |
| plant_id | UUID | FK | References `plants.id` |
| farm_id | UUID | FK | References `farms.id` |
| harvest_date | DATE | Yes | When grower marked as harvested |
| grow_days | INT | Yes | `harvest_date` minus `plant_date` |
| avg_health | INT | Yes | Average of `health_score_history` over grow period |
| fertilizer_summary | JSONB | Yes | `{ "types": [...], "count": N }` |
| pesticide_free | BOOLEAN | Yes | See trust badge rules |
| organic | BOOLEAN | Yes | See trust badge rules |
| ai_verified | BOOLEAN | Yes | See trust badge rules |
| ai_scan_count | INT | Yes | Count of `ai_analyses` rows for this plant |
| qr_token | UUID | Yes | Unique. Used in public URL `/passport/[qrToken]` |
| created_at | TIMESTAMPTZ | Auto | Default `now()` |

---

## Health Score Sub-Scores

### AI Scan Sub-Score (40% weight)
Source: latest `ai_analyses.ai_sub_score` for the plant.

| Gemini Severity | Sub-Score |
|---|---|
| `'none'` / healthy | 95 |
| `'mild'` | 75 |
| `'moderate'` | 50 |
| `'severe'` | 20 |
| No scan yet (default) | 50 |

### Watering Recency Sub-Score (25% weight)
Formula: `max(0, 100 - (daysSinceLastWatering × 10))`

Default if never watered: **0**

### Fertilizer Recency Sub-Score (20% weight)
Formula: `max(0, 100 - (daysSinceLastFertilizing × 8))`

Default if never fertilized: **0**

### Manual Status Sub-Score (15% weight)
| Status | Sub-Score |
|---|---|
| `'healthy'` | 100 |
| `'attention'` | 50 |
| `'critical'` | 0 |

Default on plant creation: `'attention'` (50)

---

## Trust Badge Calculation Rules

Calculated at harvest time and stored as booleans on `harvest_passports`. Never recalculated after harvest.

| Badge | Rule | Data Source |
|---|---|---|
| **Pesticide Free** | True if NO `growth_logs` entry for this plant has `metadata.pesticide_used = true` | `growth_logs.metadata` |
| **Organic** | True if NO `growth_logs` fertilize entry for this plant has `metadata.fertilizer_category = 'chemical'` | `growth_logs.metadata` where `event_type = 'fertilize'` |
| **AI Verified** | True if `ai_scan_count >= 1` | Count of `ai_analyses` rows for this plant |
| **Verified Grower** | True if `profiles.is_verified = true` for the farm owner | `profiles.is_verified` |

The old approach (searching free-text notes for pesticide keywords) is unreliable. Structured `metadata` fields are the correct MVP approach.

---

## RLS Policies

```sql
-- profiles: own row only
CREATE POLICY "Users read own profile"
  ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users update own profile"
  ON profiles FOR UPDATE USING (auth.uid() = id);

-- farms: own farms only
CREATE POLICY "Growers manage own farms"
  ON farms FOR ALL USING (auth.uid() = user_id);

-- plants: through farm ownership
CREATE POLICY "Growers manage own plants"
  ON plants FOR ALL USING (
    farm_id IN (SELECT id FROM farms WHERE user_id = auth.uid())
  );

-- zones: through farm ownership
CREATE POLICY "Growers manage own zones"
  ON zones FOR ALL USING (
    farm_id IN (SELECT id FROM farms WHERE user_id = auth.uid())
  );

-- growth_logs: through plant → farm ownership
CREATE POLICY "Growers manage own logs"
  ON growth_logs FOR ALL USING (
    plant_id IN (
      SELECT p.id FROM plants p
      JOIN farms f ON p.farm_id = f.id
      WHERE f.user_id = auth.uid()
    )
  );

-- ai_analyses: through plant → farm ownership
CREATE POLICY "Growers manage own analyses"
  ON ai_analyses FOR ALL USING (
    plant_id IN (
      SELECT p.id FROM plants p
      JOIN farms f ON p.farm_id = f.id
      WHERE f.user_id = auth.uid()
    )
  );

-- health_score_history: through plant → farm ownership
CREATE POLICY "Growers manage own score history"
  ON health_score_history FOR ALL USING (
    plant_id IN (
      SELECT p.id FROM plants p
      JOIN farms f ON p.farm_id = f.id
      WHERE f.user_id = auth.uid()
    )
  );

-- harvest_passports: grower CRUD + public read
CREATE POLICY "Growers manage own passports"
  ON harvest_passports FOR ALL USING (
    farm_id IN (SELECT id FROM farms WHERE user_id = auth.uid())
  );
CREATE POLICY "Public read passport by token"
  ON harvest_passports FOR SELECT USING (true);
```

Public SELECT on `harvest_passports` is safe because `qr_token` is a UUID — unguessable without the QR code.

For the Consumer QR page, related data (plant timeline, AI scans, farm info) is fetched **server-side** using the Supabase service role key in a server component. This avoids needing public RLS on every table.
