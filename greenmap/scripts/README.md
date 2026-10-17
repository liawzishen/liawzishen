# Database setup (Phase 2)

> **Something not loading?** Run `npm run test:smoke` first — it checks
> Supabase reachability (including the free-tier auto-pause), the demo login,
> and RLS data reads, and tells you exactly which stage is broken. With the
> dev server running, `npm run test:smoke -- --app` also verifies that pages
> render live data end-to-end.

> **Billing demo:** `npm run seed:billing` sets the demo account's billing arc
> (Percuma, 2 of 5 scans left) WITHOUT touching farms. `npm run db:seed` wipes
> and recreates the demo grower's farms — never run it against a backend
> holding data you care about.

Run the nine migrations **in order** in the Supabase SQL editor, then seed demo data.

## 1. Run the migrations

Supabase Dashboard → **SQL Editor** → **New query**. Paste each file's contents and click **Run**, in this order:

1. `supabase/migrations/0001_init.sql` — the 8 tables
2. `supabase/migrations/0002_profile_trigger.sql` — auto-create profile on signup (+ backfills your Phase 1 test users)
3. `supabase/migrations/0003_rls.sql` — Row Level Security policies
4. `supabase/migrations/0004_storage.sql` — 3 public storage buckets
5. `supabase/migrations/0005_billing.sql` — plan tiers, scan credits, payments, listing boosts
6. `supabase/migrations/0006_farm_coordinates.sql` — optional `latitude`/`longitude` on `farms`, for exact-location weather on the Map tab
7. `supabase/migrations/0007_support.sql` — customer service: refund requests, order feedback, support chat (customer-side RLS; refunds can only be created `pending`)
8. `supabase/migrations/0008_seller_support.sql` — seller side: farm-ownership RLS so growers approve/reject refunds and reply to customers, plus `listing_stock` (in/out-of-stock)
9. `supabase/migrations/0009_panoramas.sql` — 360° farm tour: `farm_panoramas` + `panorama_plant_tags` and the `farm-panoramas` storage bucket (then `npm run seed:panoramas` for the demo farm's sample tour)

Each file is **re-runnable** — running it twice is safe. `0006`–`0009` are additive — the app works without them (the affected panels show a friendly "run migration X" notice instead of breaking).

> Prefer the CLI? With the Supabase CLI linked to your project, `supabase db push` applies everything in `supabase/migrations/` automatically.

## 2. Add the service-role key

The seed script writes data directly (bypassing RLS), so it needs the service-role key.
Supabase Dashboard → **Project Settings → API → `service_role`** (the secret one).
Add it to `.env.local`:

```
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

⚠️ Server-only. Never commit it; never expose it in the browser.

## 3. Seed demo data

```bash
npm run db:seed
```

This creates:
- Demo grower **Ahmad** — login `ahmad@greenmap.demo` / `Demo1234!`
- Farm **Ladang Hijau** (Johor, Tomato, satellite background)
- ~30 plants (mostly healthy, plus 1 attention, 1 critical, 1 harvest-ready, 1 brand-new grey)
- Backdated water / fertilize / planted logs with badge metadata
- A 7-day health history for **Tomato A** (the trend-chart showcase)
- A few saved AI analyses
- One **harvested** plant with a passport at a fixed QR token:
  `/passport/00000000-0000-4000-8000-0000deadbeef`

Re-running `npm run db:seed` wipes the demo grower's farms and reseeds — safe to run anytime.

## Optional: a demo consumer account

```bash
npm run seed:consumer
```

Creates a **consumer** login `siti@greenmap.demo` / `Demo1234!` for the buyer
app at `/consumer` (Home dashboard · Market · Orders · Profile + per-order
customer service). Idempotent and farm-preserving — it touches only that one
account.

## Optional: demo customer-service data

```bash
npm run seed:support     # needs seed:consumer + migrations 0007 and 0008
```

Seeds a pending refund request, a customer message, and 4★ feedback from Siti
on Ahmad's order (Ladang Hijau · GM-L1-02), and marks Pak Choi (l3) out of
stock. Log in as `ahmad@greenmap.demo` → Sales → **Customer Service** to
approve/reject the refund and reply. Idempotent — re-running resets the demo
rows (handy after you've approved/rejected during a rehearsal).

## Verify it worked

- Supabase → **Table Editor** → `farms`, `plants`, `growth_logs` show demo rows.
- Supabase → **Authentication → Users** lists `ahmad@greenmap.demo`.
- **RLS check:** in the SQL editor, run `select * from plants;` — as the service role you'll see rows; from the app, a second account can't see Ahmad's plants (we test this properly once the farm UI exists in Phase 3–4).
