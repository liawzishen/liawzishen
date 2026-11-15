import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { aggregatePassport } from "@/lib/passport/aggregate";
import { localDateISO } from "@/lib/date";
import { guardRequest } from "@/lib/api/guard";
import { isUuid, jsonError, serverError } from "@/lib/api/http";
import { LIMITS } from "@/lib/api/rate-limit";
import type { Plant } from "@/types/database";

const SCOPE = "/api/passports/generate";

/** Postgres unique-violation: another request created the passport first. */
const UNIQUE_VIOLATION = "23505";

/**
 * POST /api/passports/generate  { plantId }
 *
 * Freezes a Harvest Passport: aggregates the plant's record + trust badges,
 * mints a qr_token, inserts the passport + a 'harvested' log, and sets
 * lifecycle_status='harvested'. Idempotent — returns the existing token if the
 * plant is already harvested. The passport is never recalculated afterwards.
 */
export async function POST(req: Request) {
  const guard = await guardRequest(req, { limit: LIMITS.write });
  if (!guard.ok) return guard.response;
  const { supabase, body } = guard;

  const plantId = body.plantId;
  if (!isUuid(plantId)) return jsonError("plantId is required", 400);

  const { data: plant } = await supabase
    .from("plants")
    .select("*")
    .eq("id", plantId)
    .single();
  if (!plant) return jsonError("Plant not found", 404);
  const p = plant as Plant;

  const admin = createAdminClient();
  const existingToken = async (): Promise<string | null> => {
    const { data } = await admin
      .from("harvest_passports")
      .select("qr_token")
      .eq("plant_id", plantId)
      .maybeSingle();
    return (data?.qr_token as string | undefined) ?? null;
  };

  // Already harvested → return the existing passport (idempotent). The plant
  // status is set again in case an earlier request stopped half-way.
  const already = await existingToken();
  if (already) {
    if (p.lifecycle_status !== "harvested") await markHarvested(admin, plantId);
    return NextResponse.json({ qr_token: already, alreadyHarvested: true });
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

  const harvestDate = localDateISO();
  const agg = aggregatePassport({
    plantDate: p.plant_date,
    harvestDate,
    logs: (logs ?? []) as { event_type: string; metadata: Record<string, unknown> | null }[],
    analysisCount: scanCount ?? 0,
    scores,
  });

  const qr_token = crypto.randomUUID();
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
    // Double tap / two tabs: the other request won the race. Same outcome.
    if (pErr.code === UNIQUE_VIOLATION) {
      const winner = await existingToken();
      if (winner) {
        return NextResponse.json({ qr_token: winner, alreadyHarvested: true });
      }
    }
    return serverError(SCOPE, pErr, "Could not create the passport. Please try again.");
  }

  const { error: logErr } = await admin.from("growth_logs").insert({
    plant_id: plantId,
    event_type: "harvested",
    note: "Harvested",
    metadata: {},
  });
  // The passport exists and is valid; a missing timeline row is not fatal.
  if (logErr) console.error(`[${SCOPE}] harvested log failed:`, logErr);
  await markHarvested(admin, plantId);

  return NextResponse.json({ qr_token });
}

async function markHarvested(
  admin: ReturnType<typeof createAdminClient>,
  plantId: string
) {
  const { error } = await admin
    .from("plants")
    .update({ lifecycle_status: "harvested" })
    .eq("id", plantId);
  if (error) console.error(`[${SCOPE}] lifecycle update failed:`, error);
}
