# GreenMap Backend Flows

## Flow 1 — Register / Login

```
User opens /auth
    ↓
Selects Register tab, chooses role (Grower / Consumer)
    ↓
Fills name, email, password
    ↓
Client calls supabase.auth.signUp({
  email, password,
  options: { data: { name, role } }
})
    ↓
Supabase creates auth.users row with role in raw_user_meta_data
    ↓
Database trigger auto-creates profiles row (id, name, email, role, is_verified=false)
    ↓
User is logged in
    ↓
Middleware reads role from session metadata
    ↓
Redirect: Grower → /farms | Consumer → /consumer
```

Login is simpler: `supabase.auth.signInWithPassword({ email, password })` → same redirect logic.

---

## Flow 2 — Farm Setup (3 Steps)

```
Grower clicks "Create New Farm" on Farm Selector
    ↓
Step 1 (/farms/new/profile):
  Fills farm name, location (state), size, crop type
  Data stored in React Context (FarmSetupContext) — NOT saved to DB yet
  Click "Next →"
    ↓
Step 2 (/farms/new/map):
  Chooses background: Smart (default) / Upload / Satellite
  If Upload: photo uploaded to Supabase Storage → URL stored in context
  If Satellite: pre-captured demo asset URL stored in context
  Preview shown. Click "Confirm Map →"
    ↓
Step 3 (/farms/new/zones):
  Optionally adds zones (name + color, max 8)
  Click "Enter My Farm →"
    ↓
ALL data written to Supabase in one batch:
  1. INSERT into farms (returns farm_id)
  2. INSERT into zones (if any, using farm_id)
    ↓
Navigate to /farms/[farmId] (Home — Quick Stats + Today's Tasks). The Konva map lives at /farms/[farmId]/field; the Map tab itself is a farms list.
```

If user refreshes mid-setup, context is lost — they restart. Acceptable for MVP.

---

## Flow 3 — Add Plant

```
Grower is on the field map (/farms/[farmId]/field)
    ↓
Clicks "+" floating button → enters placement mode
    ↓
Canvas cursor changes to crosshair
    ↓
Grower taps a position on the canvas
    ↓
Modal appears: plant name, crop type, zone (optional dropdown)
    ↓
Grower confirms
    ↓
Client:
  1. Calculates position_x and position_y as percentages (tap position / canvas dimensions)
  2. INSERT into plants (farm_id, name, type, zone_id, plant_date=today,
     position_x, position_y, health_score=NULL,
     manual_status='attention', lifecycle_status='active')
  3. INSERT into growth_logs (plant_id, event_type='planted', note='Plant added')
    ↓
New marker appears on canvas as a grey "New" pin (health_score is NULL until
the first scoring event fires — D4). No history row is written at planting.
```

---

## Flow 4 — Log Water / Fertilizer / Note

```
Grower is on Plant Detail page
    ↓
Clicks quick action button (💧 Water / 🌿 Fertilizer / 📝 Note)
    ↓
Modal opens with fields:
  Water: date (auto-filled), optional note
  Fertilizer: type, amount, category (organic/chemical/unknown),
              pesticide_used checkbox, optional note
  Note: text, optional photo, optional pesticide_used checkbox
    ↓
Grower confirms
    ↓
Client:
  1. INSERT into growth_logs (plant_id, event_type, note, photo_url, metadata)
     metadata includes fertilizer_category, pesticide_used, etc.
  2. If photo: upload to Supabase Storage (growth-photos bucket) first
  3. Call POST /api/health/recalculate with plantId
    ↓
API route:
  1. Fetches latest water date, fertilizer date, AI sub-score, plant status
  2. Runs health score formula
  3. UPDATE plants SET health_score = [result]
  4. INSERT into health_score_history (plant_id, score)
  5. Returns new score to client
    ↓
Plant Detail page updates health display
Farm Map marker will update on next load
```

---

## Flow 5 — AI Scan

```
Grower is on AI Scan page (/farms/[farmId]/plants/[plantId]/scan)
    ↓
Selects or takes a plant photo (JPG/PNG/WEBP)
    ↓
Client uploads photo to Supabase Storage (plant-scans bucket) → gets public URL
    ↓
Client sends { imageUrl, cropType, plantId } to POST /api/ai/scan
    ↓
API route:
  1. Fetches image from URL
  2. Sends to Gemini Vision with structured prompt (crop type as context)
  3. Parses JSON response
  4. Validates:
     a. JSON parse check — if malformed, retry once with stricter prompt
     b. Severity enum check — must be none/mild/moderate/severe, default to 'moderate'
     c. Confidence range clamp — clamp to 0–100
  5. Maps severity → ai_sub_score (none→95, mild→75, moderate→50, severe→20)
  6. Returns { diagnosis, severity, confidence, ai_sub_score, recommendations }
    ↓
If Gemini fails after retry: return fallback object
  { diagnosis: "Unable to analyze", severity: "none", confidence: 0,
    ai_sub_score: 50, recommendations: ["Please try again with a clearer photo"] }
    ↓
Client displays result on screen
    ↓
*** RESULT IS NOT AUTO-SAVED ***
    ↓
Two buttons shown:
  "Save to Plant Record" — triggers save flow
  "Scan Again" — discards result, clears upload
    ↓
Grower clicks "Save to Plant Record":
  Client calls POST /api/ai/save-scan — the SERVER does the writes:
  1. Re-sanitises + INSERT into ai_analyses (plant_id, image_url, diagnosis,
     confidence, severity, ai_sub_score, recommendations)
  2. INSERT into growth_logs (plant_id, event_type='ai_scan',
     metadata={ diagnosis, severity, confidence })
  3. Recalculate + snapshot via shared lib/health/recalculate.ts
    ↓
Health score updates. Farm Map marker updates on next load.
```

---

## Flow 6 — Health Score Recalculation

```
Triggered by: POST /api/health/recalculate with { plantId }
    ↓
API route fetches from Supabase (using service role key):
  1. Latest ai_analyses.ai_sub_score for this plant (or default 50)
  2. Latest growth_logs where event_type='water' → calculate days since
  3. Latest growth_logs where event_type='fertilize' → calculate days since
  4. plants.manual_status for this plant
    ↓
Runs formula:
  wateringSubScore = max(0, 100 - (daysSinceWater × 10))
  fertilizerSubScore = max(0, 100 - (daysSinceFertilizer × 8))
  manualSubScore = manual_status mapping (healthy→100, attention→50, critical→0)

  healthScore = round(
    (aiSubScore × 0.40) +
    (wateringSubScore × 0.25) +
    (fertilizerSubScore × 0.20) +
    (manualSubScore × 0.15)
  )
    ↓
UPDATE plants SET health_score = [result] WHERE id = plantId
    ↓
INSERT into health_score_history (plant_id, score)
    ↓
Return { healthScore, status } to client
```

The same formula also runs **client-side** on page load for passive decay display — but client-side does NOT write to the database.

---

## Flow 7 — Health Score History Snapshot

Not a separate flow — it happens inside Flow 6. Every time the API route updates `plants.health_score`, it also inserts a row into `health_score_history`. This powers the 7-day trend chart on Plant Detail (a dependency-free inline SVG — Recharts is not used).

---

## Flow 8 — Harvest Passport Generation

```
Grower is on Plant Detail page
    ↓
Clicks "Mark as Harvested"
    ↓
Confirmation modal: "Are you sure? This will generate a Harvest Passport."
    ↓
Grower confirms
    ↓
Client calculates passport data:
  1. grow_days = today - plant_date
  2. avg_health = average of health_score_history rows for this plant
  3. ai_scan_count = count of ai_analyses rows for this plant
  4. fertilizer_summary = aggregate from growth_logs where event_type='fertilize'
     { types: [unique fertilizer_type values], count: N }
  5. pesticide_free = NO growth_logs entry has metadata.pesticide_used = true
  6. organic = NO growth_logs fertilize entry has metadata.fertilizer_category = 'chemical'
  7. ai_verified = ai_scan_count >= 1
  8. qr_token = crypto.randomUUID()
  (All computed server-side in the /api/passports/generate route.)
    ↓
Client calls POST /api/passports/generate — the SERVER (idempotent):
  1. Aggregates fields via lib/passport/aggregate.ts (grow_days, avg_health,
     ai_scan_count, fertilizer_summary, pesticide_free, organic, ai_verified)
  2. INSERT into harvest_passports (+ mints qr_token)
  3. INSERT into growth_logs (plant_id, event_type='harvested')
  4. UPDATE plants SET lifecycle_status = 'harvested'
    ↓
Redirect to the public passport at /passport/[qrToken]
    ↓
Harvest Passport page displays:
  - Passport card with all summary data
  - Trust badges (only earned badges shown)
  - QR code linking to /passport/[qrToken]
```

Note: `profiles.is_verified` for the Verified Grower badge is read separately from the grower's profile. In MVP, this is manually set (e.g. via Supabase dashboard). Automatic verification is Phase 2.

---

## Flow 9 — Consumer QR View

```
Consumer (or anyone) scans QR code or opens link
    ↓
Browser navigates to /passport/[qrToken]
    ↓
This is a Next.js SERVER COMPONENT (no auth required)
    ↓
Server-side fetch using Supabase service role key:
  1. SELECT * FROM harvest_passports WHERE qr_token = [token]
  2. JOIN plants (for plant name, type, plant_date)
  3. JOIN farms (for farm name, location, crop type)
  4. JOIN profiles (for grower name, is_verified)
  5. SELECT * FROM growth_logs WHERE plant_id = [id] ORDER BY created_at ASC
  6. SELECT * FROM ai_analyses WHERE plant_id = [id] ORDER BY created_at ASC
    ↓
Page renders:
  - Grower + farm info
  - Plant story (auto-generated sentence)
  - Trust badges
  - Health summary (avg_health, ai_scan_count)
  - Full activity timeline with photos
  - AI scan results (diagnosis, recommendations)
  - "Powered by GreenMap" footer
    ↓
No login wall. No auth check. Public page.
QR token is a UUID — unguessable without the QR code.
```

The server component uses the service role key to bypass RLS and fetch all related data in one request. This avoids needing public RLS policies on every table.
