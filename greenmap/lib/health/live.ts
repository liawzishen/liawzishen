import { createClient } from "@/lib/supabase/server";
import { liveDisplayScore } from "./calculate";
import type { Plant } from "@/types/database";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

export type LiveHealth = {
  /** plant id → live display score (null = "New", per D4). */
  scores: Map<string, number | null>;
  /** plant id → ISO timestamp of the most recent water log. */
  lastWater: Map<string, string>;
  /** plant id → ISO timestamp of the most recent fertilize log. */
  lastFertilize: Map<string, string>;
};

/**
 * Compute each plant's LIVE display score (passive decay) WITHOUT writing,
 * plus the last-care timestamps the score is derived from — so callers that
 * also need "last watered / fertilized" (e.g. the Home task list) reuse this
 * instead of re-querying growth_logs.
 *
 * Uses the same pure formula the server writes with (lib/health/calculate.ts),
 * so the map and the plant detail page always agree. Plants whose stored score
 * is still null stay null ("New", per D4 — we never invent a number for them).
 * Batched: two queries total regardless of how many plants there are.
 */
export async function liveHealthForPlants(
  supabase: ServerClient,
  plants: Plant[]
): Promise<LiveHealth> {
  const scores = new Map<string, number | null>();
  const lastWater = new Map<string, string>();
  const lastFertilize = new Map<string, string>();
  if (plants.length === 0) return { scores, lastWater, lastFertilize };
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
    scores.set(
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
  return { scores, lastWater, lastFertilize };
}

/** Score-only view of liveHealthForPlants, for callers that don't need care data. */
export async function liveScoresForPlants(
  supabase: ServerClient,
  plants: Plant[]
): Promise<Map<string, number | null>> {
  return (await liveHealthForPlants(supabase, plants)).scores;
}
