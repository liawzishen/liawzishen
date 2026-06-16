/**
 * GreenMap demo seed — idempotent.
 *
 * Creates the demo grower "Ahmad", farm "Ladang Hijau" (Johor, Tomato), ~30
 * plants with varied health, backdated logs, a 7-day score history for one
 * showcase plant, a couple of AI analyses, and ONE harvested plant with a
 * FIXED qr_token so you can pre-print the QR code for the demo.
 *
 * Run:  npx tsx scripts/seed-demo.ts
 * Reset+reseed is automatic (it wipes the demo grower's data first).
 *
 * Requires in .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY   (server-only; bypasses RLS — never ship to client)
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
    "\n✖ Missing env. Add NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to .env.local.\n" +
      "  (Service role key: Supabase Dashboard → Project Settings → API → service_role.)\n"
  );
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/* ── Demo constants ─────────────────────────────────────────────────────── */
const DEMO_EMAIL = "ahmad@greenmap.demo";
const DEMO_PASSWORD = "Demo1234!"; // meets the strong-password rules
const DEMO_NAME = "Ahmad bin Abdullah";
// Fixed so the printed QR keeps working across reseeds:
const DEMO_QR_TOKEN = "00000000-0000-4000-8000-0000deadbeef";

/** days-ago → ISO timestamp */
const daysAgo = (n: number) =>
  new Date(Date.now() - n * 86_400_000).toISOString();
/** days-ago → YYYY-MM-DD */
const dateAgo = (n: number) => daysAgo(n).slice(0, 10);

async function findDemoUserId(): Promise<string | null> {
  // listUsers is paginated; the demo project is tiny so page 1 is enough.
  const { data, error } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });
  if (error) throw error;
  return data.users.find((u) => u.email === DEMO_EMAIL)?.id ?? null;
}

async function ensureDemoUser(): Promise<string> {
  const existing = await findDemoUserId();
  if (existing) return existing;

  const { data, error } = await admin.auth.admin.createUser({
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
    email_confirm: true, // skip the confirmation step for the demo account
    user_metadata: { name: DEMO_NAME, role: "grower" },
  });
  if (error) throw error;
  return data.user.id;
}

async function wipeFarms(userId: string) {
  // ON DELETE CASCADE clears zones, plants, logs, analyses, history, passports.
  const { error } = await admin.from("farms").delete().eq("user_id", userId);
  if (error) throw error;
}

async function main() {
  console.log("🌱 Seeding GreenMap demo data…");

  const userId = await ensureDemoUser();
  console.log(`  • demo grower ready (${DEMO_EMAIL})`);

  // Make sure the profile exists and is a Verified Grower (badge demo).
  await admin
    .from("profiles")
    .upsert(
      {
        id: userId,
        name: DEMO_NAME,
        email: DEMO_EMAIL,
        role: "grower",
        is_verified: true,
      },
      { onConflict: "id" }
    );

  await wipeFarms(userId);
  console.log("  • cleared previous demo farms");

  // ── Farm ────────────────────────────────────────────────────────────────
  const { data: farm, error: farmErr } = await admin
    .from("farms")
    .insert({
      user_id: userId,
      name: "Ladang Hijau",
      location: "Johor",
      size: "medium",
      crop_type: "Tomato",
      // Pre-captured satellite image lives in public/demo/ (added in Phase 8).
      background_type: "satellite",
      background_url: "/demo/ladang-hijau-satellite.jpg",
      canvas_width: 1200,
      canvas_height: 800,
    })
    .select()
    .single();
  if (farmErr) throw farmErr;
  console.log(`  • farm "${farm.name}" created`);

  // ── Zones ─────────────────────────────────────────────────────────────────
  const { data: zones, error: zoneErr } = await admin
    .from("zones")
    .insert([
      { farm_id: farm.id, name: "North Plot", color: "#34C759" },
      { farm_id: farm.id, name: "Greenhouse", color: "#007AFF" },
      { farm_id: farm.id, name: "South Plot", color: "#FF9F0A" },
    ])
    .select();
  if (zoneErr) throw zoneErr;

  // ── Plants ────────────────────────────────────────────────────────────────
  // A spread of healthy plants + a few standouts for the demo story.
  type PlantSeed = {
    name: string;
    type: string;
    health: number | null;
    manual: "healthy" | "attention" | "critical";
    lifecycle: "active" | "harvested";
    daysOld: number;
    expectHarvestInDays?: number; // negative/0 => harvest-ready
    showcase?: boolean; // gets 7-day history + AI analysis
    brandNew?: boolean; // null score, grey marker
  };

  const seeds: PlantSeed[] = [
    {
      name: "Tomato A",
      type: "Tomato",
      health: 92,
      manual: "healthy",
      lifecycle: "active",
      daysOld: 40,
      expectHarvestInDays: 12,
      showcase: true,
    },
    {
      name: "Tomato B",
      type: "Tomato",
      health: 61,
      manual: "attention",
      lifecycle: "active",
      daysOld: 33,
      expectHarvestInDays: 20,
    },
    {
      name: "Tomato C",
      type: "Tomato",
      health: 34,
      manual: "critical",
      lifecycle: "active",
      daysOld: 28,
    },
    {
      name: "Chili D",
      type: "Chili",
      health: 88,
      manual: "healthy",
      lifecycle: "active",
      daysOld: 25,
      expectHarvestInDays: 0, // harvest-ready
    },
    {
      name: "Tomato E (New)",
      type: "Tomato",
      health: null,
      manual: "attention",
      lifecycle: "active",
      daysOld: 0,
      brandNew: true,
    },
    {
      name: "Tomato Z (Harvested)",
      type: "Tomato",
      health: 90,
      manual: "healthy",
      lifecycle: "harvested",
      daysOld: 70,
    },
  ];

  // Pad to ~30 healthy background plants so the map looks alive.
  for (let i = 1; i <= 24; i++) {
    seeds.push({
      name: `Tomato ${i + 5}`,
      type: "Tomato",
      health: 70 + ((i * 7) % 26), // 70–95
      manual: "healthy",
      lifecycle: "active",
      daysOld: 15 + (i % 20),
      expectHarvestInDays: 10 + (i % 25),
    });
  }

  const plantRows = seeds.map((s, i) => {
    // Spread positions across the canvas in a loose grid (0.08–0.92).
    const cols = 6;
    const col = i % cols;
    const row = Math.floor(i / cols);
    return {
      farm_id: farm.id,
      zone_id: zones[i % zones.length].id,
      name: s.name,
      type: s.type,
      plant_date: dateAgo(s.daysOld),
      expected_harvest_date:
        s.expectHarvestInDays === undefined
          ? null
          : dateAgo(-s.expectHarvestInDays), // future date
      position_x: 0.08 + col * (0.84 / (cols - 1)),
      position_y: 0.12 + row * 0.16,
      health_score: s.health,
      manual_status: s.manual,
      lifecycle_status: s.lifecycle,
    };
  });

  const { data: plants, error: plantErr } = await admin
    .from("plants")
    .insert(plantRows)
    .select();
  if (plantErr) throw plantErr;
  console.log(`  • ${plants.length} plants planted`);

  // ── Logs / history / analyses / passport ───────────────────────────────
  const logs: Array<Record<string, unknown>> = [];
  const history: Array<Record<string, unknown>> = [];
  const analyses: Array<Record<string, unknown>> = [];

  for (let i = 0; i < plants.length; i++) {
    const plant = plants[i];
    const seed = seeds[i];

    // Every plant: a 'planted' event on its plant date.
    logs.push({
      plant_id: plant.id,
      event_type: "planted",
      note: `Planted ${seed.name}`,
      created_at: daysAgo(seed.daysOld),
    });

    // A recent watering (organic-friendly, pesticide-free metadata).
    logs.push({
      plant_id: plant.id,
      event_type: "water",
      note: "Morning watering",
      metadata: { method: "drip" },
      created_at: daysAgo(Math.min(2, seed.daysOld)),
    });

    // An organic fertilize event → supports Organic + Pesticide-Free badges.
    logs.push({
      plant_id: plant.id,
      event_type: "fertilize",
      note: "Compost top-up",
      metadata: {
        fertilizer_type: "Compost",
        fertilizer_category: "organic",
        amount: "100g",
        pesticide_used: false,
      },
      created_at: daysAgo(Math.min(5, seed.daysOld)),
    });

    // Showcase plant: 7 days of history + one AI analysis.
    if (seed.showcase) {
      const curve = [78, 80, 83, 85, 88, 90, 92];
      curve.forEach((score, d) => {
        history.push({
          plant_id: plant.id,
          score,
          created_at: daysAgo(6 - d),
        });
      });
      analyses.push({
        plant_id: plant.id,
        image_url: "/demo/tomato-leaf-healthy.jpg",
        diagnosis: "Healthy foliage. No disease detected.",
        confidence: 94,
        severity: "none",
        ai_sub_score: 95,
        recommendations: [
          "Maintain current watering schedule.",
          "Continue weekly organic feeding.",
        ],
        created_at: daysAgo(1),
      });
      logs.push({
        plant_id: plant.id,
        event_type: "ai_scan",
        note: "AI scan: Healthy",
        metadata: { diagnosis: "Healthy foliage", severity: "none", confidence: 94 },
        created_at: daysAgo(1),
      });
    }

    // The harvested plant: a 'harvested' log + a passport with the fixed token.
    if (seed.lifecycle === "harvested") {
      logs.push({
        plant_id: plant.id,
        event_type: "harvested",
        note: "Harvested and packed",
        created_at: daysAgo(1),
      });
      analyses.push({
        plant_id: plant.id,
        image_url: "/demo/tomato-leaf-healthy.jpg",
        diagnosis: "Ripe and healthy at harvest.",
        confidence: 91,
        severity: "none",
        ai_sub_score: 95,
        recommendations: ["Harvest within 3 days for peak ripeness."],
        created_at: daysAgo(2),
      });

      const { error: passErr } = await admin.from("harvest_passports").insert({
        plant_id: plant.id,
        farm_id: farm.id,
        harvest_date: dateAgo(1),
        grow_days: seed.daysOld - 1,
        avg_health: 90,
        fertilizer_summary: { types: ["Compost"], count: 1 },
        pesticide_free: true,
        organic: true,
        ai_verified: true,
        ai_scan_count: 1,
        qr_token: DEMO_QR_TOKEN,
      });
      if (passErr) throw passErr;
    }
  }

  const ins = async (table: string, rows: Record<string, unknown>[]) => {
    if (!rows.length) return;
    // growth_logs.metadata is NOT NULL — ensure every row carries it.
    const safeRows =
      table === "growth_logs"
        ? rows.map((r) => ({ metadata: {}, ...r }))
        : rows;
    const { error } = await admin.from(table).insert(safeRows);
    if (error) throw error;
  };
  await ins("growth_logs", logs as Record<string, unknown>[]);
  await ins("health_score_history", history as Record<string, unknown>[]);
  await ins("ai_analyses", analyses as Record<string, unknown>[]);

  console.log(
    `  • ${logs.length} logs, ${history.length} history points, ${analyses.length} AI analyses`
  );
  console.log("\n✅ Demo seed complete.");
  console.log(`   Login:  ${DEMO_EMAIL}  /  ${DEMO_PASSWORD}`);
  console.log(`   Public passport QR token:  ${DEMO_QR_TOKEN}`);
  console.log(`   → /passport/${DEMO_QR_TOKEN}\n`);
}

main().catch((err) => {
  console.error("\n✖ Seed failed:", err.message ?? err);
  process.exit(1);
});
