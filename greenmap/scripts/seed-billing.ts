/**
 * Demo BILLING state — safe and farm-preserving.
 *
 * Unlike seed-demo.ts (which WIPES and recreates the demo grower's farms),
 * this only sets up the judge-demo billing arc for the demo account:
 *   plan = percuma, bonus_scans = 0, and exactly 3 scans used this month
 *   → the demo starts at "2 of 5 scans left"; two scans later the paywall
 *     appears live and you upgrade via the simulated FPX/TnG checkout.
 *
 * Run:  npm run seed:billing        (idempotent; touches ONLY the demo user)
 * Requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.local
 * and migration 0005_billing.sql applied.
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/* ── Tiny .env.local loader (no dotenv dependency) ──────────────────────── */
function loadEnv() {
  try {
    const text = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    for (const line of text.split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) {
        process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
      }
    }
  } catch {
    // no .env.local — rely on real environment variables
  }
}
loadEnv();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error(
    "✖ Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.local"
  );
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const DEMO_EMAIL = "ahmad@greenmap.demo";
const USED_THIS_MONTH = 3; // Percuma is 5/month → demo starts with 2 left

async function main() {
  console.log("🌱 Setting demo billing state…");

  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (error) throw error;
  const user = data.users.find((u) => u.email === DEMO_EMAIL);
  if (!user) {
    console.error(
      `✖ Demo user ${DEMO_EMAIL} not found — run \`npm run db:seed\` on a FRESH project first.`
    );
    process.exit(1);
  }

  const { error: pErr } = await admin
    .from("profiles")
    .update({ plan: "percuma", bonus_scans: 0, plan_renews_at: null })
    .eq("id", user.id);
  if (pErr) {
    console.error(
      `✖ ${pErr.message}\n  → Is migration 0005 applied? Paste supabase/migrations/0005_billing.sql into the Supabase SQL editor and run it.`
    );
    process.exit(1);
  }

  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const { error: dErr } = await admin
    .from("ai_scan_usage")
    .delete()
    .eq("user_id", user.id)
    .gte("created_at", monthStart.toISOString());
  if (dErr) throw dErr;

  const rows = Array.from({ length: USED_THIS_MONTH }, (_, i) => ({
    user_id: user.id,
    created_at: new Date(Date.now() - (i + 1) * 60_000).toISOString(),
  }));
  const { error: iErr } = await admin.from("ai_scan_usage").insert(rows);
  if (iErr) throw iErr;

  console.log(
    `✅ ${DEMO_EMAIL}: plan=percuma, ${USED_THIS_MONTH} of 5 scans used → 2 left.`
  );
  console.log("   Farms, plants and history were NOT touched.");
}

main().catch((err) => {
  console.error("✖ seed:billing failed:", err.message ?? err);
  process.exit(1);
});
