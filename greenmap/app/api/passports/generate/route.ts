import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { aggregatePassport } from "@/lib/passport/aggregate";
import type { Plant } from "@/types/database";

/**
 * POST /api/passports/generate  { plantId }
 *
 * Freezes a Harvest Passport: aggregates the plant's record + trust badges,
 * mints a qr_token, inserts the passport + a 'harvested' log, and sets
 * lifecycle_status='harvested'. Idempotent — returns the existing token if the
 * plant is already harvested. The passport is never recalculated afterwards.
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let plantId: string | undefined;
  try {
    plantId = (await req.json())?.plantId;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!plantId) {
    return NextResponse.json({ error: "plantId is required" }, { status: 400 });
  }

  const { data: plant } = await supabase
    .from("plants")
    .select("*")
    .eq("id", plantId)
    .single();
  if (!plant) {
    return NextResponse.json({ error: "Plant not found" }, { status: 404 });
  }
  const p = plant as Plant;

  // Already harvested → return the existing passport (idempotent).
  const { data: existing } = await supabase
    .from("harvest_passports")
    .select("qr_token")
    .eq("plant_id", plantId)
    .maybeSingle();
  if (existing?.qr_token) {
    return NextResponse.json({ qr_token: existing.qr_token, alreadyHarvested: true });
  }

  const [{ data: logs }, { count: scanCount }, { data: history }] =
    await Promise.all([
      supabase.from("growth_logs").select("event_type, metadata").eq("plant_id", plantId),
      supabase
        .from("ai_analyses")
        .select("*", { count: "exact", head: true })
        .eq("plant_id", plantId),
      supabase.from("health_score_history").select("score").eq("plant_id", plantId),
    ]);

  const scores = (history ?? []).map((h) => (h as { score: number }).score);
  if (scores.length === 0 && p.health_score !== null) scores.push(p.health_score);

  const harvestDate = new Date().toISOString().slice(0, 10);
  const agg = aggregatePassport({
    plantDate: p.plant_date,
    harvestDate,
    logs: (logs ?? []) as { event_type: string; metadata: Record<string, unknown> | null }[],
    analysisCount: scanCount ?? 0,
    scores,
  });

  const qr_token = crypto.randomUUID();
  const admin = createAdminClient();

  const { error: pErr } = await admin.from("harvest_passports").insert({
    plant_id: plantId,
    farm_id: p.farm_id,
    harvest_date: harvestDate,
    grow_days: agg.grow_days,
    avg_health: agg.avg_health,
    fertilizer_summary: agg.fertilizer_summary,
    pesticide_free: agg.pesticide_free,
    organic: agg.organic,
    ai_verified: agg.ai_verified,
    ai_scan_count: agg.ai_scan_count,
    qr_token,
  });
  if (pErr) {
    return NextResponse.json({ error: pErr.message }, { status: 500 });
  }

  await admin.from("growth_logs").insert({
    plant_id: plantId,
    event_type: "harvested",
    note: "Harvested",
    metadata: {},
  });
  await admin.from("plants").update({ lifecycle_status: "harvested" }).eq("id", plantId);

  return NextResponse.json({ qr_token });
}
