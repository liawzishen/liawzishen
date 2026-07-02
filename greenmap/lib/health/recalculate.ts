import { createAdminClient } from "@/lib/supabase/admin";
import { calculateHealthScore } from "./calculate";
import type { ManualStatus } from "@/types/database";

type Admin = ReturnType<typeof createAdminClient>;

/**
 * Recompute + persist a plant's health score, and snapshot it to
 * health_score_history. Shared by /api/health/recalculate and
 * /api/ai/save-scan so the write path lives in exactly one place. Call only
 * AFTER verifying the caller owns the plant (this uses the service role).
 */
export async function recalculatePlantScore(
  admin: Admin,
  plantId: string
): Promise<number> {
  const { data: plant } = await admin
    .from("plants")
    .select("manual_status")
    .eq("id", plantId)
    .single();
  if (!plant) throw new Error("Plant not found");

  const [{ data: water }, { data: fert }, { data: ai }] = await Promise.all([
    admin
      .from("growth_logs")
      .select("created_at")
      .eq("plant_id", plantId)
      .eq("event_type", "water")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from("growth_logs")
      .select("created_at")
      .eq("plant_id", plantId)
      .eq("event_type", "fertilize")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from("ai_analyses")
      .select("ai_sub_score")
      .eq("plant_id", plantId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const score = calculateHealthScore({
    aiSubScore: ai?.ai_sub_score ?? null,
    lastWaterAt: water?.created_at ?? null,
    lastFertilizeAt: fert?.created_at ?? null,
    manualStatus: (plant as { manual_status: ManualStatus }).manual_status,
  });

  const { error: updateErr } = await admin
    .from("plants")
    .update({ health_score: score })
    .eq("id", plantId);
  if (updateErr) throw new Error(updateErr.message);

  const { error: histErr } = await admin
    .from("health_score_history")
    .insert({ plant_id: plantId, score });
  if (histErr) throw new Error(histErr.message);

  return score;
}

/**
 * Recalculate many plants in parallel, best-effort — one plant failing never
 * blocks the rest. Powers the batch "Water All / Fertilize All" routes, where
 * recalculating dozens of plants one-by-one made the request scale linearly.
 */
export async function recalculateManyPlantScores(
  admin: Admin,
  plantIds: Iterable<string>
): Promise<void> {
  await Promise.all(
    [...plantIds].map((id) => recalculatePlantScore(admin, id).catch(() => {}))
  );
}
