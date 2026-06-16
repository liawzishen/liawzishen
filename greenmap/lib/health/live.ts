import { createClient } from "@/lib/supabase/server";
import { liveDisplayScore } from "./calculate";
import type { Plant } from "@/types/database";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Compute each plant's LIVE display score (passive decay) WITHOUT writing.
 *
 * Uses the same pure formula the server writes with (lib/health/calculate.ts),
 * so the map and the plant detail page always agree. Plants whose stored score
 * is still null stay null ("New", per D4 — we never invent a number for them).
 * Batched: two queries total regardless of how many plants there are.
 */
export async function liveScoresForPlants(
  supabase: ServerClient,
  plants: Plant[]
): Promise<Map<string, number | null>> {
  const out = new Map<string, number | null>();
  if (plants.length === 0) return out;
  const ids = plants.map((p) => p.id);

  const [{ data: logs }, { data: scans }] = await Promise.all([
    supabase
      .from("growth_logs")
      .select("plant_id, event_type, created_at")
      .in("plant_id", ids)
      .in("event_type", ["water", "fertilize"])
      .order("created_at", { ascending: false }),
    supabase
      .from("ai_analyses")
      .select("plant_id, ai_sub_score, created_at")
      .in("plant_id", ids)
      .order("created_at", { ascending: false }),
  ]);

  const lastWater = new Map<string, string>();
  const lastFertilize = new Map<string, string>();
  for (const l of logs ?? []) {
    if (l.event_type === "water" && !lastWater.has(l.plant_id)) {
      lastWater.set(l.plant_id, l.created_at);
    } else if (l.event_type === "fertilize" && !lastFertilize.has(l.plant_id)) {
      lastFertilize.set(l.plant_id, l.created_at);
    }
  }

  const lastAi = new Map<string, number>();
  for (const s of scans ?? []) {
    if (!lastAi.has(s.plant_id)) lastAi.set(s.plant_id, s.ai_sub_score);
  }

  const now = new Date();
  for (const p of plants) {
    out.set(
      p.id,
      liveDisplayScore(p.health_score, {
        aiSubScore: lastAi.get(p.id) ?? null,
        lastWaterAt: lastWater.get(p.id) ?? null,
        lastFertilizeAt: lastFertilize.get(p.id) ?? null,
        manualStatus: p.manual_status,
        now,
      })
    );
  }
  return out;
}
