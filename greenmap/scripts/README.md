# Database setup (Phase 2)

> **Something not loading?** Run `npm run test:smoke` first — it checks
> Supabase reachability (including the free-tier auto-pause), the demo login,
> and RLS data reads, and tells you exactly which stage is broken. With the
> dev server running, `npm run test:smoke -- --app` also verifies that pages
> render live data end-to-end.

Run the four migrations **in order** in the Supabase SQL editor, then seed demo data.

## 1. Run the migrations

Supabase Dashboard → **SQL Editor** → **New query**. Paste each file's contents and click **Run**, in this order:

1. `supabase/migrations/0001_init.sql` — the 8 tables
2. `supabase/migrations/0002_profile_trigger.sql` — auto-create profile on signup (+ backfills your Phase 1 test users)
3. `supabase/migrations/0003_rls.sql` — Row Level Security policies
4. `supabase/migrations/0004_storage.sql` — 3 public storage buckets

Each file is **re-runnable** — running it twice is safe.

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
  `/passport/00000000-0000-4000-8000-00000000d3m0`

Re-running `npm run db:seed` wipes the demo grower's farms and reseeds — safe to run anytime.

## Verify it worked

- Supabase → **Table Editor** → `farms`, `plants`, `growth_logs` show demo rows.
- Supabase → **Authentication → Users** lists `ahmad@greenmap.demo`.
- **RLS check:** in the SQL editor, run `select * from plants;` — as the service role you'll see rows; from the app, a second account can't see Ahmad's plants (we test this properly once the farm UI exists in Phase 3–4).
