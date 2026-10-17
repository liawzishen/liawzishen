/**
 * Seed 3 demo panoramas (committed under public/demo/) onto the demo farm
 * "Ladang Hijau" with a few plant tags each. Idempotent: wipes the demo
 * farm's panoramas first. Requires migration 0009 and the same env as
 * seed-demo.ts (NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY).
 *
 * Run: npx tsx scripts/seed-panoramas.ts   (npm run seed:panoramas)
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

// Standing spots + headings chosen to spread across the demo canvas.
const PANOS = [
  { file: "/demo/pano-1.jpg", x: 0.22, y: 0.3, heading: 0, label: "Near the gate" },
  { file: "/demo/pano-2.jpg", x: 0.55, y: 0.58, heading: 40, label: "Middle rows" },
  { file: "/demo/pano-3.jpg", x: 0.82, y: 0.32, heading: -60, label: "Far corner" },
];

async function main() {
  // 1. demo user → farm
  // listUsers is paginated (default 50/page); match the other seeds' 200.
  const { data: userList, error: uErr } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });
  if (uErr) throw uErr;
  const user = userList.users.find((u) => u.email === DEMO_EMAIL);
  if (!user)
    throw new Error(`Demo user ${DEMO_EMAIL} not found — run npm run db:seed first`);

  const { data: farm, error: fErr } = await admin
    .from("farms")
    .select("id")
    .eq("user_id", user.id)
    .limit(1)
    .single();
  if (fErr || !farm) throw new Error("Demo farm not found — run npm run db:seed first");

  // 2. wipe + insert panoramas (tags cascade)
  const { error: dErr } = await admin
    .from("farm_panoramas")
    .delete()
    .eq("farm_id", farm.id);
  if (dErr) throw dErr; // otherwise a re-run silently duplicates the tour
  const { data: created, error: iErr } = await admin
    .from("farm_panoramas")
    .insert(
      PANOS.map((p) => ({
        farm_id: farm.id,
        image_url: p.file,
        position_x: p.x,
        position_y: p.y,
        heading_deg: p.heading,
        label: p.label,
      }))
    )
    .select();
  if (iErr || !created) throw iErr ?? new Error("insert failed");

  // 3. tag the 2 plants nearest each spot (spread around the horizon)
  const { data: plants, error: plErr } = await admin
    .from("plants")
    .select("id, position_x, position_y")
    .eq("farm_id", farm.id)
    .eq("lifecycle_status", "active");
  if (plErr || !plants) throw plErr ?? new Error("plants fetch failed");

  const tags: {
    panorama_id: string;
    plant_id: string;
    yaw: number;
    pitch: number;
  }[] = [];
  for (const pano of created) {
    const nearest = [...plants]
      .sort(
        (a, b) =>
          Math.hypot(a.position_x - pano.position_x, a.position_y - pano.position_y) -
          Math.hypot(b.position_x - pano.position_x, b.position_y - pano.position_y)
      )
      .slice(0, 2);
    nearest.forEach((plant, i) => {
      tags.push({
        panorama_id: pano.id,
        plant_id: plant.id,
        yaw: i === 0 ? 0.6 : -1.1, // spread left/right of centre
        pitch: -0.12, // slightly below the horizon, like plants on the ground
      });
    });
  }
  if (tags.length > 0) {
    const { error: tErr } = await admin.from("panorama_plant_tags").insert(tags);
    if (tErr) throw tErr;
  }

  console.log(
    `✓ Seeded ${created.length} panoramas + ${tags.length} plant tags on the demo farm.`
  );
}

main().catch((err) => {
  console.error("✖", err.message ?? err);
  process.exit(1);
});
